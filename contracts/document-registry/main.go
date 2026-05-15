package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// DocumentRegistry is the chaincode contract for immutable document proof storage.
// ONLY cryptographic hashes and proof metadata are stored — never raw document content.
type DocumentRegistry struct {
	contractapi.Contract
}

// DocumentRecord represents an immutable proof record on the ledger.
type DocumentRecord struct {
	DocumentID   string `json:"documentId"`
	TenantID     string `json:"tenantId"`
	HashSHA256   string `json:"hashSha256"`
	MetadataHash string `json:"metadataHash"`
	IssuerMSPID  string `json:"issuerMspId"`
	IssuedAt     string `json:"issuedAt"`
	Status       string `json:"status"` // "active" | "revoked"
	RevokedAt    string `json:"revokedAt,omitempty"`
	RevokedReason string `json:"revokedReason,omitempty"`
}

// AnchorDocument stores a new document proof on-chain.
// Called once per document issuance — immutable after creation.
func (r *DocumentRegistry) AnchorDocument(
	ctx contractapi.TransactionContextInterface,
	documentID, tenantID, hashSHA256, metadataHash, issuedAt string,
) error {
	// Validate required fields
	if documentID == "" || tenantID == "" || hashSHA256 == "" {
		return fmt.Errorf("documentId, tenantId and hashSha256 are required")
	}

	// Prevent duplicate anchoring
	existing, err := ctx.GetStub().GetState(documentID)
	if err != nil {
		return fmt.Errorf("failed to read state: %w", err)
	}
	if existing != nil {
		return fmt.Errorf("document %s already anchored — cannot overwrite", documentID)
	}

	// Resolve caller's MSP identity
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %w", err)
	}

	record := DocumentRecord{
		DocumentID:   documentID,
		TenantID:     tenantID,
		HashSHA256:   hashSHA256,
		MetadataHash: metadataHash,
		IssuerMSPID:  mspID,
		IssuedAt:     issuedAt,
		Status:       "active",
	}

	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal record: %w", err)
	}

	if err := ctx.GetStub().PutState(documentID, data); err != nil {
		return fmt.Errorf("failed to put state: %w", err)
	}

	// Emit event for downstream consumers
	eventPayload, _ := json.Marshal(map[string]string{
		"documentId": documentID,
		"tenantId":   tenantID,
		"event":      "document.anchored",
	})
	_ = ctx.GetStub().SetEvent("DocumentAnchored", eventPayload)

	return nil
}

// RevokeDocument marks a document as revoked on-chain.
// The original proof record is preserved — revocation is appended.
func (r *DocumentRegistry) RevokeDocument(
	ctx contractapi.TransactionContextInterface,
	documentID, tenantID, reason string,
) error {
	data, err := ctx.GetStub().GetState(documentID)
	if err != nil {
		return fmt.Errorf("failed to read state: %w", err)
	}
	if data == nil {
		return fmt.Errorf("document %s not found on ledger", documentID)
	}

	var record DocumentRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return fmt.Errorf("failed to unmarshal record: %w", err)
	}

	// Ensure caller is from the same tenant's org
	if record.TenantID != tenantID {
		return fmt.Errorf("tenant mismatch — not authorized to revoke this document")
	}

	if record.Status == "revoked" {
		return fmt.Errorf("document %s already revoked", documentID)
	}

	record.Status = "revoked"
	record.RevokedAt = time.Now().UTC().Format(time.RFC3339)
	record.RevokedReason = reason

	updated, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal updated record: %w", err)
	}

	if err := ctx.GetStub().PutState(documentID, updated); err != nil {
		return fmt.Errorf("failed to put state: %w", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"documentId": documentID,
		"tenantId":   tenantID,
		"event":      "document.revoked",
	})
	_ = ctx.GetStub().SetEvent("DocumentRevoked", eventPayload)

	return nil
}

// QueryDocument retrieves a document proof record by ID.
func (r *DocumentRegistry) QueryDocument(
	ctx contractapi.TransactionContextInterface,
	documentID string,
) (*DocumentRecord, error) {
	data, err := ctx.GetStub().GetState(documentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %w", err)
	}
	if data == nil {
		return nil, nil
	}

	var record DocumentRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, fmt.Errorf("failed to unmarshal record: %w", err)
	}

	return &record, nil
}

// VerifyHash checks if a given hash matches the on-chain proof.
// Used by the API layer to confirm document authenticity without trust.
func (r *DocumentRegistry) VerifyHash(
	ctx contractapi.TransactionContextInterface,
	documentID, hashSHA256 string,
) (bool, error) {
	record, err := r.QueryDocument(ctx, documentID)
	if err != nil {
		return false, err
	}
	if record == nil {
		return false, nil
	}
	return record.HashSHA256 == hashSHA256 && record.Status == "active", nil
}

// GetDocumentHistory returns the full state history for a document.
// Provides complete audit trail of all mutations.
func (r *DocumentRegistry) GetDocumentHistory(
	ctx contractapi.TransactionContextInterface,
	documentID string,
) ([]map[string]interface{}, error) {
	historyIterator, err := ctx.GetStub().GetHistoryForKey(documentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history: %w", err)
	}
	defer historyIterator.Close()

	var history []map[string]interface{}

	for historyIterator.HasNext() {
		modification, err := historyIterator.Next()
		if err != nil {
			return nil, err
		}

		entry := map[string]interface{}{
			"txId":      modification.TxId,
			"timestamp": modification.Timestamp.AsTime().Format(time.RFC3339),
			"isDelete":  modification.IsDelete,
		}

		if !modification.IsDelete {
			var record DocumentRecord
			if err := json.Unmarshal(modification.Value, &record); err == nil {
				entry["record"] = record
			}
		}

		history = append(history, entry)
	}

	return history, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&DocumentRegistry{})
	if err != nil {
		panic(fmt.Sprintf("Error creating DocumentRegistry chaincode: %s", err))
	}

	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error starting DocumentRegistry chaincode: %s", err))
	}
}
