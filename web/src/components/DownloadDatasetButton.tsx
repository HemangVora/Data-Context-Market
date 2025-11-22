"use client";

import { useIsSignedIn } from "@coinbase/cdp-hooks";
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useX402Payment, type DownloadResult } from "@/hooks/useX402Payment";

interface DownloadDatasetButtonProps {
  pieceCid: string;
  datasetName: string;
  price: number;
  onDownloadSuccess?: (result: DownloadResult) => void;
}

export function DownloadDatasetButton({
  pieceCid,
  datasetName,
  price,
  onDownloadSuccess,
}: DownloadDatasetButtonProps) {
  const { isSignedIn } = useIsSignedIn();
  const {
    downloadWithPayment,
    isProcessing,
    error: paymentError,
  } = useX402Payment();
  const [downloadState, setDownloadState] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!isSignedIn) {
      setErrorMessage("Please connect your wallet first");
      setDownloadState("error");
      return;
    }

    try {
      setDownloadState("processing");
      setErrorMessage(null);

      console.log("[Download] Starting download for:", pieceCid);
      const result = await downloadWithPayment(pieceCid);

      console.log("[Download] Download successful:", result);
      setDownloadState("success");

      // Handle the downloaded content
      if (result.format === "text" || result.format === "binary") {
        // For text or binary content, create a downloadable file
        const blob = new Blob([result.content], {
          type: result.mimeType || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename || result.name || `${pieceCid}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (result.format === "file" && result.content) {
        // For base64 encoded files
        const byteCharacters = atob(result.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: result.mimeType || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename || result.name || `${pieceCid}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Call success callback
      if (onDownloadSuccess) {
        onDownloadSuccess(result);
      }

      // Reset state after 3 seconds
      setTimeout(() => {
        setDownloadState("idle");
      }, 3000);
    } catch (err: any) {
      console.error("[Download] Error:", err);
      setErrorMessage(err.message || "Download failed");
      setDownloadState("error");
    }
  };

  if (!isSignedIn) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-500 cursor-not-allowed text-sm font-medium"
      >
        <Download className="w-4 h-4" />
        <span>Connect Wallet</span>
      </button>
    );
  }

  if (downloadState === "success") {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/50 text-green-400 text-sm font-medium"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>Downloaded!</span>
      </button>
    );
  }

  if (downloadState === "error") {
    return (
      <div className="space-y-2">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-all text-sm font-medium"
        >
          <AlertCircle className="w-4 h-4" />
          <span>Retry</span>
        </button>
        {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}
      </div>
    );
  }

  const buttonText =
    price > 0 ? `Download ($${price.toFixed(2)})` : "Download (Free)";

  return (
    <button
      onClick={handleDownload}
      disabled={isProcessing || downloadState === "processing"}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-700 disabled:cursor-not-allowed transition-all text-sm font-medium"
    >
      {isProcessing || downloadState === "processing" ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
}
