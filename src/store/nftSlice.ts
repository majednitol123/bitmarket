// import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
// import { Contract, JsonRpcProvider, Provider } from "ethers";

// import ERC721ABI from "../constants/abis/ERC721.json";
// import ERC1155ABI from "../constants/abis/ERC1155.json";

// /* ---------------- NFT TYPES ---------------- */
// export type NFTStandard = "ERC721" | "ERC1155" | "UNKNOWN";

// export interface NFT {
//   chainId: number;
//   contractAddress: string;
//   tokenId: string;
//   name?: string;
//   description?: string;
//   image?: string;
//   owner: string;
//   standard?: NFTStandard;
// }

// /* ---------------- STATE ---------------- */
// interface NFTState {
//   nfts: {
//     [chainId: number]: {
//       [account: string]: NFT[];
//     };
//   };
// }

// const initialState: NFTState = { nfts: {} };

// async function fetchMetadataFromURI(uri: string) {
//   try {
//     if (uri.startsWith("ipfs://")) uri = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
//     const res = await fetch(uri);
//     return await res.json();
//   } catch {
//     return {};
//   }
// }


// export async function fetchNFTByContract(
//   provider: JsonRpcProvider,
//   chainId: number,
//   contractAddress: string,
//   tokenId: string,
//   owner: string
// ): Promise<NFT> {

//   try {
//     const erc721 = new Contract(contractAddress, ERC721ABI, provider);

//     // Check ownership
//     const tokenOwner: string = await erc721.ownerOf(tokenId);
//     if (tokenOwner.toLowerCase() !== owner.toLowerCase()) {
//       throw new Error("Owner mismatch");
//     }

//     // Fetch metadata
//     let tokenURI: string = await erc721.tokenURI(tokenId);
//     const metadata = await fetchMetadataFromURI(tokenURI);

//     return {
//       chainId,
//       contractAddress,
//       tokenId,
//       name: metadata.name ?? `Token #${tokenId}`,
//       description: metadata.description,
//       image: metadata.image?.startsWith("ipfs://") ? metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/") : metadata.image,
//       owner,
//       standard: "ERC721",
//     };
//   } catch {
//     // console.warn("Not ERC721, trying ERC1155");
//   }

//   // Try ERC1155
//   try {
//     const erc1155 = new Contract(contractAddress, ERC1155ABI, provider);
//     const balance = await erc1155.balanceOf(owner, tokenId);
//     if (balance.toNumber() === 0) throw new Error("Owner does not hold this token");

//     let uri: string = await erc1155.uri(tokenId);
//     const metadata = await fetchMetadataFromURI(uri);

//     return {
//       chainId,
//       contractAddress,
//       tokenId,
//       name: metadata.name ?? `Token #${tokenId}`,
//       description: metadata.description,
//       image: metadata.image?.startsWith("ipfs://") ? metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/") : metadata.image,
//       owner,
//       standard: "ERC1155",
//     };
//   } catch {
//     // console.warn("Not ERC1155");
//   }
//   return {
//     chainId,
//     contractAddress,
//     tokenId,
//     owner,
//     standard: "UNKNOWN",
//   };
// }

// /* ---------------- ASYNC THUNKS ---------------- */
// export const importNft = createAsyncThunk(
//   "nft/import",
//   async ({
//     chainId,
//     account,
//     provider,
//     contractAddress,
//     tokenId,
//   }: {
//     chainId: number;
//     account: string;
//    provider: JsonRpcProvider
//     contractAddress: string;
//     tokenId: string;
//   }) => {
//     const nft: NFT = await fetchNFTByContract(provider, chainId, contractAddress, tokenId, account);
//     return { chainId, account, nft };
//   }
// );

// /* ---------------- SLICE ---------------- */
// const nftSlice = createSlice({
//   name: "nft",
//   initialState,
//   reducers: {
//     clearNFTsForAccount(
//       state,
//       action: PayloadAction<{ chainId: number; account: string }>
//     ) {
//       const { chainId, account } = action.payload;
//       state.nfts[chainId]?.[account] && delete state.nfts[chainId][account];
//     },
//     removeNFT(
//       state,
//       action: PayloadAction<{
//         chainId: number;
//         account: string;
//         contractAddress: string;
//         tokenId: string;
//       }>
//     ) {
//       const { chainId, account, contractAddress, tokenId } = action.payload;
//       const accountNFTs = state.nfts[chainId]?.[account];
//       if (!accountNFTs) return;
//       state.nfts[chainId][account] = accountNFTs.filter(
//         (n) =>
//           !(
//             n.contractAddress.toLowerCase() === contractAddress.toLowerCase() &&
//             n.tokenId === tokenId
//           )
//       );
//     },
//   },
//   extraReducers: (builder) => {
//     builder.addCase(importNft.fulfilled, (state, action) => {
//       const { chainId, account, nft } = action.payload;
//       state.nfts[chainId] ??= {};
//       state.nfts[chainId][account] ??= [];

//       const exists = state.nfts[chainId][account].some(
//         (n) =>
//           n.contractAddress.toLowerCase() === nft.contractAddress.toLowerCase() &&
//           n.tokenId === nft.tokenId
//       );

//       if (!exists) {
//         state.nfts[chainId][account].push(nft);
//       }
//     });
//   },
// });

// export const { clearNFTsForAccount, removeNFT } = nftSlice.actions;
// export default nftSlice.reducer;
