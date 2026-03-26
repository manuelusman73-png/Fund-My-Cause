export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col gap-6 p-8 max-w-4xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-gray-800 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-xl h-52" />
        ))}
      </div>
    </div>
  );
}
