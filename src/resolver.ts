import {
  AbstractResolverModule,
  DNS_RECORD_TYPE,
  DNSRecord,
  DNSResult,
  resolverEmptyResponse,
  resolverError,
  ResolverOptions,
  resolveSuccess,
} from "@lumeweb/libresolver";
import { ethers } from "ethers";
import { createClient, createProvider } from "@lumeweb/kernel-eth-client";
// @ts-ignore
import { ENS } from "@ensdomains/ensjs";

const ETH_PROVIDER = createProvider();
// @ts-ignore
ETH_PROVIDER._isProvider = true;

const ETH_SIGNER = new ethers.VoidSigner(ethers.ZeroAddress, ETH_PROVIDER);
// @ts-ignore
ETH_SIGNER._isSigner = true;

// @ts-ignore
ETH_PROVIDER.getSigner = () => ETH_SIGNER;

let ENSInstance: ENS;
const ETH_CLIENT = createClient();

async function getEns() {
  if (!ENSInstance) {
    ENSInstance = new ENS({
      graphURI: null,
    });

    await ENSInstance.setProvider(ETH_PROVIDER as any);
  }

  return ENSInstance;
}

export default class Eth extends AbstractResolverModule {
  // @ts-ignore
  getSupportedTlds(): string[] {
    return ["eth"];
  }

  async resolve(
    domain: string,
    options: ResolverOptions,
    bypassCache: boolean,
  ): Promise<DNSResult> {
    const hip5Data = domain.split(".");
    if (
      2 <= hip5Data.length &&
      options.options &&
      "domain" in options.options
    ) {
      if (ethers.isAddress(hip5Data[0])) {
        let chain = hip5Data[1].replace("_", "");
        domain = options.options.domain;

        if (chain !== "eth") {
          return resolverError("HIP5 chain not supported");
        }
        return this.resolve137(domain, options, bypassCache);
      }
    }

    if (await this.isTldSupported(domain)) {
      return this.resolve137(domain, options, bypassCache);
    }

    return resolverEmptyResponse();
  }

  private async resolve137(
    domain: string,
    options: ResolverOptions,
    bypassCache: boolean,
  ): Promise<DNSResult> {
    const records: DNSRecord[] = [];

    const ens = await getEns();

    let content;
    if (
      [DNS_RECORD_TYPE.CONTENT, DNS_RECORD_TYPE.TEXT].includes(options.type)
    ) {
      try {
        content = await ens.getContentHash(domain);
      } catch (e: any) {
        return resolverError(e);
      }

      records.push({
        type: DNS_RECORD_TYPE.CONTENT,
        value: `${content.protocolType}://${content.decoded}` as string,
      });
    }

    if ([DNS_RECORD_TYPE.CUSTOM].includes(options.type)) {
      let text;
      try {
        text = await ens.getText(domain, options.customType as string);
      } catch (e: any) {
        return resolverError(e);
      }

      records.push({
        type: options.type,
        customType: options.customType,
        value: text as string,
      });
    }

    if (0 < records.length) {
      return resolveSuccess(records);
    }

    return resolverEmptyResponse();
  }

  async ready(): Promise<void> {
    return ((await ETH_CLIENT.status()) as any)?.ready;
  }
}
