import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-6xl font-bold text-white">404</h1>
      <p className="text-gray-400 text-lg">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
