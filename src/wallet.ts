import { createConfig, http, fallback } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { mainnet } from "viem/chains";
import { PUBLIC_RPC } from "./chain";
export const config = createConfig({
  chains: [mainnet],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({ appName: "MAD · Mutually Assured Destruction" }),
  ],
  transports: {
    [mainnet.id]: fallback([http(PUBLIC_RPC), http("https://eth.merkle.io")]),
  },
});
