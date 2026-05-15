import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainClient } from '@veritas/blockchain-client';

@Module({
  providers: [
    {
      provide: BlockchainClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new BlockchainClient({
          channelName: config.get<string>('blockchain.channelName', 'veritas-channel'),
          chaincodeName: config.get<string>('blockchain.chaincodeName', 'document-registry'),
          mspId: config.get<string>('blockchain.mspId', 'VeritasMSP'),
          peerEndpoint: config.get<string>('blockchain.peerEndpoint', 'localhost:7051'),
          tlsCertPath: config.get<string>('blockchain.tlsCertPath', ''),
          certPath: config.get<string>('blockchain.certPath', ''),
          keyPath: config.get<string>('blockchain.keyPath', ''),
        });
        return client;
      },
    },
  ],
  exports: [BlockchainClient],
})
export class BlockchainModule {}
