import { initCloudRelayListener } from '@/remoteBridge/relayClient';

class RemoteRelayService {
  static init() {
    initCloudRelayListener();
  }
}

export default RemoteRelayService;
