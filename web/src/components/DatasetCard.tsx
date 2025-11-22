import { Download, HardDrive, Tag } from "lucide-react";

interface DatasetCardProps {
  title: string;
  description: string;
  price: string;
  format: string;
  size: string;
  author: string;
  tags: string[];
}

export function DatasetCard({
  title,
  description,
  price,
  format,
  size,
  tags,
}: DatasetCardProps) {
  return (
    <div className="group relative flex flex-col justify-between p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300">
      {/* Header */}
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
            {format}
          </div>
          <div className="flex items-center gap-1 text-emerald-400/80 font-mono text-sm">
            <span className="text-lg font-semibold">{price}</span> ETH
          </div>
        </div>

        <h3 className="text-lg font-semibold text-neutral-100 mb-2 leading-tight group-hover:text-indigo-200 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-neutral-500 line-clamp-2 mb-6">
          {description}
        </p>
      </div>

      {/* Tech Specs Row */}
      <div className="mt-auto border-t border-white/5 pt-4 flex items-center justify-between">
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

        <button className="p-2 rounded-full bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 text-neutral-400 transition-colors">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
