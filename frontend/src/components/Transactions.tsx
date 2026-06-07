import TransactionTable from "./TransactionTable";

export default function Transactions() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Transactions</h1>
      <TransactionTable />
    </div>
  );
}
