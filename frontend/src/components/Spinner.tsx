export default function Spinner() {
  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
