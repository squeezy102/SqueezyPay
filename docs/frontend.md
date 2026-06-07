# Frontend

The frontend is a React 18 + TypeScript + Vite application styled with Tailwind CSS.

## Structure

```
frontend/
├── src/
│   ├── main.tsx              Entry point
│   ├── App.tsx               Root component — tab routing
│   ├── types.ts              TypeScript interfaces (mirrors backend serializers)
│   ├── components/
│   │   ├── NavBar.tsx        Sidebar (desktop) + top bar (mobile)
│   │   ├── Dashboard.tsx     Main dashboard — balances, bills, income, spend
│   │   ├── Accounts.tsx      Bank connection, account balance cards
│   │   ├── Transactions.tsx  Transaction history table
│   │   ├── Bills.tsx         Unified bills hub — four sub-views (see below)
│   │   ├── CredentialModal.tsx  Standalone credential create/edit modal
│   │   ├── Spending.tsx      Blame graph — category and account breakdown
│   │   ├── Income.tsx        Income stream management
│   │   ├── Settings.tsx      Passphrase, sync preferences
│   │   ├── Budget.tsx        Budget targets (not yet active)
│   │   └── PlaidLinkButton.tsx  Plaid Link modal trigger
│   └── utils/
│       ├── api.ts            All API fetch functions
│       └── billUtils.ts      Bill date math (overdue, due-soon)
├── public/
│   └── manifest.json         PWA manifest
└── vite.config.ts
```

## Routing

There is no React Router. Routing is client-side tab state managed in `App.tsx`:

```tsx
const [activeTab, setActiveTab] = useState("dashboard");
```

`NavBar` receives `activeTab` and `setActiveTab`. Each tab ID maps to a component:

| Tab ID | Component |
|---|---|
| `dashboard` | `Dashboard` |
| `accounts` | `Accounts` |
| `transactions` | `Transactions` |
| `bills` | `Bills` |
| `spending` | `Spending` |
| `income` | `Income` |
| `settings` | `Settings` |
| `budget` | `Budget` (disabled) |

## Bills hub — `Bills.tsx`

`Bills.tsx` is the unified bill management component (~700 lines). It replaces the former `BillPayments` tab entirely. Sub-view state is managed by a `useState<SubView>` hook at the root of the component.

**Sub-views:**

| SubView | Description |
|---|---|
| `overview` | CTA banner + summary stats (due today, overdue count, upcoming) |
| `pay-bills` | Grid of `BillCard` tiles — one per active bill |
| `payment-history` | Searchable, sortable payment log table |
| `manage-billers` | CRUD table: add/edit/delete billers, notes popover, credential key button |

The **credential key button** in `ManageBillers` opens `CredentialModal` for the selected biller. The **"Go to {bill.name}" button** in the `PayBills` view calls the autofill endpoint when credentials exist and the user is not on mobile; on mobile (or when autofill returns false) it falls back to `window.open`.

Mobile detection is done inline: `window.innerWidth < 768` at call time.

## CredentialModal — `CredentialModal.tsx`

Standalone exported component. Mounted by both `ManageBillers` (key icon in biller row) and `LogPaymentModal` ("Set up credentials →" link). Positioned at `z-60` so it appears above other modals.

Handles both create and update via `saveCredential` from `api.ts`. Shows a delete button when editing an existing credential.

## Navigation — `NavBar.tsx`

The nav uses a union type:

```ts
type NavDivider = { type: "divider"; label: string };
type NavTab     = { type: "tab"; id: string; label: string; icon: React.ReactNode; disabled?: boolean };
type NavItem    = NavTab | NavDivider;
```

`navItems` is an array of `NavItem`. Dividers render as labelled horizontal rules between groups. Both the sidebar (desktop) and mobile top bar iterate over the same array, branching on `item.type`.

## State management

TanStack Query v5 (React Query) manages all server state. Do not use `useEffect` + `fetch` for data fetching.

Common patterns:

```tsx
// Query
const { data: items = [], isLoading } = useQuery<PlaidItem[]>({
  queryKey: ["plaid", "items"],
  queryFn: getPlaidItems,
});

// Mutation with cache invalidation
const mutation = useMutation({
  mutationFn: (id: number) => disconnectPlaidItem(id),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ["plaid"] });
  },
});
```

Query keys follow a hierarchy: `["plaid"]`, `["plaid", "items"]`, `["plaid", "accounts"]`, `["plaid", "transactions"]`, `["plaid", "blame"]`. Invalidating `["plaid"]` refreshes all Plaid data.

## Plaid Link — `PlaidLinkButton.tsx`

`usePlaidLink` from `react-plaid-link` injects Plaid's script tag into the DOM on mount. **Only one instance may be mounted at a time.** Mounting two `PlaidLinkButton` components simultaneously causes a console warning and potential double-initialization.

`Accounts.tsx` enforces this with three mutually exclusive render states:
1. `itemsLoading` → no `PlaidLinkButton` in the tree
2. `!isConnected` → exactly one `PlaidLinkButton` in `NoBankConnected`
3. Connected → no `PlaidLinkButton` anywhere (connect affordance removed)

Do not add `PlaidLinkButton` to any other component that may be mounted simultaneously with `Accounts.tsx`.

## API layer — `api.ts`

All fetch calls are centralized in `frontend/src/utils/api.ts`. Components never call `fetch` directly.

Functions follow the pattern:

```ts
export async function getPlaidAccounts(): Promise<PlaidAccount[]> {
  const res = await fetch("/api/plaid/accounts", { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

`authHeaders()` reads the JWT from `sessionStorage` and returns `{ Authorization: "Bearer <token>" }`.

Notable functions beyond the standard fetch wrappers:

| Function | Description |
|---|---|
| `saveCredential(data)` | Create or update credentials for a bill. Calls `POST /api/credentials` or `PUT /api/credentials/{id}` depending on whether `data.id` is present. |
| `deleteCredential(credentialId)` | Delete a credential by ID. Returns `true` on success. |
| `autofillBill(billId)` | Call `POST /api/bills/{bill_id}/autofill`. Returns `true` if the browser was opened with fields filled, `false` otherwise. |

## TypeScript types — `types.ts`

Interfaces match backend serializers. When a backend serializer adds or renames a field, update `types.ts` to match.

Key interfaces: `PlaidItem`, `PlaidAccount`, `PlaidTransaction`, `Bill`, `Payment`, `IncomeStream`, `BlameData`.

## Tailwind conventions

- All styling via Tailwind utility classes. No inline `style={}` except for dynamic values (e.g. percentage widths for progress bars).
- Dark mode via `dark:` variants. The app defaults to the system color scheme.
- Responsive breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px). Most layouts go single-column on mobile, two-column on `lg:`.

## Forms

React Hook Form for all user input forms. No uncontrolled inputs, no manual `onChange` wiring.

## Running in development

```powershell
cd frontend
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`. Configured in `vite.config.ts`.

## Building for production

```powershell
cd frontend
npm run build
```

Output goes to `frontend/dist/`. The backend serves these static files when the frontend is not running separately. See [deployment.md](deployment.md).

## Linting

```powershell
npm run lint
```

ESLint with `typescript-eslint`. Wired into CI — a PR that introduces lint errors will not merge.
