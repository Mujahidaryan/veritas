################################################################################
# Veritas — Google Cloud Platform Infrastructure
# Author: Muhammad Mujahid (github.com/Mujahidaryan)
# Provider: GCP | Region: asia-south1 (Mumbai — closest to Pakistan)
################################################################################

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  backend "gcs" {
    bucket = "veritas-terraform-state"
    prefix = "production"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ─── Variables ───────────────────────────────────────────────────

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-south1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# ─── GKE Cluster ─────────────────────────────────────────────────

resource "google_container_cluster" "veritas" {
  name     = "veritas-${var.environment}"
  location = "${var.region}-a"

  # Remove default node pool — use custom
  remove_default_node_pool = true
  initial_node_count       = 1

  # Networking
  network    = google_compute_network.veritas.name
  subnetwork = google_compute_subnetwork.veritas.name

  # Security
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }

  # Enable Shielded Nodes
  enable_shielded_nodes = true

  # Private cluster — no public endpoint
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  addons_config {
    http_load_balancing { disabled = false }
    horizontal_pod_autoscaling { disabled = false }
    network_policy_config { disabled = false }
  }

  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  logging_service    = "logging.googleapis.com/kubernetes"
  monitoring_service = "monitoring.googleapis.com/kubernetes"
}

resource "google_container_node_pool" "veritas_nodes" {
  name     = "veritas-nodes"
  location = "${var.region}-a"
  cluster  = google_container_cluster.veritas.name

  initial_node_count = 2

  autoscaling {
    min_node_count = 2
    max_node_count = 10
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    preemptible  = false
    machine_type = "e2-standard-4"  # 4 vCPU, 16GB RAM

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    service_account = google_service_account.gke_nodes.email

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }
  }
}

# ─── Cloud SQL (PostgreSQL 16) ────────────────────────────────────

resource "google_sql_database_instance" "veritas" {
  name             = "veritas-postgres-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region
  deletion_protection = true

  settings {
    tier              = "db-custom-2-7680"  # 2 vCPU, 7.5GB RAM
    availability_type = "REGIONAL"          # High availability

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"  # 3 AM UTC+5
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
      }
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.veritas.id
      enable_private_path_for_google_cloud_services = true
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 3
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
    }
  }
}

resource "google_sql_database" "veritas" {
  name     = "veritas_db"
  instance = google_sql_database_instance.veritas.name
}

# ─── Cloud Storage Bucket ────────────────────────────────────────

resource "google_storage_bucket" "documents" {
  name          = "veritas-documents-${var.project_id}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  # Encryption with CMEK
  encryption {
    default_kms_key_name = google_kms_crypto_key.veritas.id
  }
}

# ─── KMS Key for CMEK ─────────────────────────────────────────────

resource "google_kms_key_ring" "veritas" {
  name     = "veritas-keyring"
  location = var.region
}

resource "google_kms_crypto_key" "veritas" {
  name            = "veritas-storage-key"
  key_ring        = google_kms_key_ring.veritas.id
  rotation_period = "7776000s"  # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# ─── VPC Network ──────────────────────────────────────────────────

resource "google_compute_network" "veritas" {
  name                    = "veritas-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "veritas" {
  name          = "veritas-subnet"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.veritas.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/20"
  }

  private_ip_google_access = true
}

# ─── Service Accounts ─────────────────────────────────────────────

resource "google_service_account" "gke_nodes" {
  account_id   = "veritas-gke-nodes"
  display_name = "Veritas GKE Node Pool SA"
}

resource "google_project_iam_member" "gke_nodes_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_storage_bucket_iam_member" "gke_storage" {
  bucket = google_storage_bucket.documents.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# ─── Secret Manager ───────────────────────────────────────────────

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "veritas-jwt-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "db_url" {
  secret_id = "veritas-database-url"
  replication {
    auto {}
  }
}

# ─── Outputs ──────────────────────────────────────────────────────

output "gke_cluster_name" {
  value = google_container_cluster.veritas.name
}

output "database_instance" {
  value = google_sql_database_instance.veritas.connection_name
}

output "storage_bucket" {
  value = google_storage_bucket.documents.name
}
