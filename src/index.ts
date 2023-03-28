import {
  AbstractResolverModule,
  DNS_RECORD_TYPE,
  DNSRecord,
  DNSResult,
  isPromise,
  resolverEmptyResponse,
  resolverError,
  ResolverOptions,
  resolveSuccess,
} from "@lumeweb/libresolver";
import { ethers } from "ethers";
import { createProvider } from "@lumeweb/kernel-eth-client";
// @ts-ignore
import ENSRoot, { getEnsAddress } from "@lumeweb/ensjs";

const ENS = ENSRoot.default;

const ETH_PROVIDER = createProvider();
// @ts-ignore
ETH_PROVIDER._isProvider = true;

const ETH_SIGNER = new ethers.VoidSigner(ethers.ZeroAddress, ETH_PROVIDER);
// @ts-ignore
ETH_SIGNER._isSigner = true;

// @ts-ignore
ETH_PROVIDER.getSigner = () => ETH_SIGNER;

export default class Eth extends AbstractResolverModule {
  // @ts-ignore
  getSupportedTlds(): string[] {
    return ["eth"];
  }

  async resolve(
    domain: string,
    options: ResolverOptions,
    bypassCache: boolean
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
    bypassCache: boolean
  ): Promise<DNSResult> {
    const records: DNSRecord[] = [];

    const ens = new ENS({
      provider: ETH_PROVIDER,
      ensAddress: getEnsAddress(1),
    });

    let name;
    try {
      name = await ens.name(domain);
    } catch (e: any) {
      return resolverError(e);
    }

    let content;
    if (
      [DNS_RECORD_TYPE.CONTENT, DNS_RECORD_TYPE.TEXT].includes(options.type)
    ) {
      try {
        content = maybeGetContentHash(await name.getContent());
      } catch (e: any) {
        return resolverError(e);
      }

      records.push({
        type: DNS_RECORD_TYPE.CONTENT,
        value: content as string,
      });
    }

    if ([DNS_RECORD_TYPE.CUSTOM].includes(options.type)) {
      let text;
      try {
        text = await name.getText(options.customType);
      } catch (e: any) {
        return resolverError(e);
      }

      records.push({
        type: options.type,
        customType: options.customType,
        value: content as string,
      });
    }

    if (0 < records.length) {
      return resolveSuccess(records);
    }

    return resolverEmptyResponse();
  }
}

export function maybeGetContentHash(contentResult: any): string | boolean {
  let content = false;

  if (
    typeof contentResult === "object" &&
    "contenthash" === contentResult.contentType
  ) {
    content = contentResult.value;
  }

  return content;
}
