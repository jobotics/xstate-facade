import { AssetTypeEnum } from "../interfaces/swap-machine.in.interfaces";

export const mapAssetKey = (type: AssetTypeEnum, token: string): string => {
  switch (type) {
    case AssetTypeEnum.nep141:
      return `near:mainnet:${token}`;
    default:
      return "";
  }
};
