import { ExternalLink, HardDrive, Tag } from "lucide-react";
import { PurchaseDatasetButton } from "./PurchaseDatasetButton";
import { DownloadDatasetButton } from "./DownloadDatasetButton";
import { type DownloadResult } from "@/hooks/useX402Payment";

interface DatasetCardProps {
  title: string;
  description: string;
  price: number;
  format: string;
  size: string;
  author: string;
  tags: string[];
  txHash?: string;
  payAddress?: string;
  pieceCid?: string;
}

export function DatasetCard({
  title,
  description,
  price,
  format,
  size,
  tags,
  txHash,
  payAddress,
  pieceCid,
}: DatasetCardProps) {
  const handlePurchaseSuccess = (result: DownloadResult) => {
    console.log("Dataset purchased successfully!", {
      dataset: title,
      pieceCid: result.pieceCid,
      size: result.size,
      format: result.format,
    });
    // Here you could:
    // - Show a success toast
    // - Trigger a download
    // - Update UI state
    // - Store purchase record
  };

  return (
    <div className="group relative flex flex-col justify-between p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300">
      {/* Header */}
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
            {format}
          </div>
          <div className="flex items-center gap-1 text-emerald-400/80 font-mono text-sm">
            <span className="text-lg font-semibold">{price}</span> USDC
          </div>
        </div>

        <h3 className="text-lg font-semibold text-neutral-100 mb-2 leading-tight group-hover:text-indigo-200 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-neutral-500 line-clamp-2 mb-6">
          {description}
        </p>
      </div>

      {/* Actions and Tech Specs */}
      <div className="mt-auto space-y-4">
        {/* Download Button with x402 Payment */}
        {pieceCid && (
          <div className="w-full">
            <DownloadDatasetButton
              pieceCid={pieceCid}
              datasetName={title}
              price={price}
              onDownloadSuccess={handlePurchaseSuccess}
            />
          </div>
        )}

        {/* Tech Specs Row */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-neutral-400 font-mono">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3 h-3" />
              {size}
            </div>
            <div className="flex items-center gap-1.5">
              <Tag className="w-3 h-3" />
              {tags[0]}
            </div>
          </div>

          {txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 text-neutral-400 transition-colors text-xs font-mono"
              title="View transaction on Etherscan"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View TX</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
