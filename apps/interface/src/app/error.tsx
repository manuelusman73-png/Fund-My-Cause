"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
      <p className="text-gray-400 max-w-md">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        className="mt-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
