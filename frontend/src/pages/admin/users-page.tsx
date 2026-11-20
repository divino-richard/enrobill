import { PageHeader } from "@/components/page-header";
import { TablePanel, TableToolbar } from "@/components/table-panel";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  Eye,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  FunnelXIcon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/form/password-input";
import { FieldLabel } from "@/components/form/field-label";
import { PasswordRequirements } from "@/features/auth/components/password-requirements";
import { passwordIsStrong } from "@/features/auth/password";
import { useAuthStore } from "@/features/auth/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { UserRoleBadge } from "@/features/users/components/user-role-badge";
import { UserStatusBadge } from "@/features/users/components/user-status-badge";
import { UserStatusDialog } from "@/features/users/components/user-status-dialog";
import { useCreateUser, useUsers } from "@/features/users/hooks";
import {
  CREATABLE_USER_ROLE_OPTIONS,
  USER_ROLE_OPTIONS,
  type CreatableUserRole,
  type CreateUserInput,
  type User,
  type UserRole,
} from "@/features/users/types";
import { formatDate } from "@/features/applications/utils";
import { getErrorMessage } from "@/lib/get-error-message";

type RoleFilter = UserRole | "all";
type StatusFilter = "active" | "inactive" | "all";
type CreateUserForm = Omit<CreateUserInput, "role"> & {
  role: CreatableUserRole | "";
};

const EMPTY_USER_FORM: CreateUserForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  role: "",
  password: "",
  passwordConfirmation: "",
};

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createUser = useCreateUser();
  const [form, setForm] = useState<CreateUserForm>(EMPTY_USER_FORM);
  const passwordValid = passwordIsStrong(form.password);
  const passwordsMatch = Boolean(form.password) && form.password === form.passwordConfirmation;
  const canCreate = Boolean(
    form.firstName.trim() && form.lastName.trim() && form.email.trim() &&
    form.role && passwordValid && passwordsMatch,
  );

  function changeOpen(next: boolean) {
    if (createUser.isPending) return;
    if (!next) {
      setForm(EMPTY_USER_FORM);
      createUser.reset();
    }
    onOpenChange(next);
  }

  function update<K extends keyof CreateUserForm>(
    field: K,
    value: CreateUserForm[K],
  ) {
    createUser.reset();
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user account</DialogTitle>
          <DialogDescription>
            The account is ready immediately. Share the temporary password
            securely and ask the user to change it after signing in.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const role = form.role;
            if (!role || !canCreate || createUser.isPending) return;

            createUser.mutate({ ...form, role }, {
              onSuccess: () => {
                setForm(EMPTY_USER_FORM);
                onOpenChange(false);
              },
            });
          }}
        >
          <fieldset
            disabled={createUser.isPending}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5">
              <FieldLabel htmlFor="user-first-name" required>First name</FieldLabel>
              <Input
                id="user-first-name"
                required
                maxLength={100}
                autoFocus
                value={form.firstName}
                onChange={(event) => update("firstName", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="user-middle-name" optional>Middle name</FieldLabel>
              <Input
                id="user-middle-name"
                maxLength={100}
                value={form.middleName}
                onChange={(event) => update("middleName", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor="user-last-name" required>Last name</FieldLabel>
              <Input
                id="user-last-name"
                required
                maxLength={100}
                value={form.lastName}
                onChange={(event) => update("lastName", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor="user-email" required>Email</FieldLabel>
              <Input
                id="user-email"
                type="email"
                required
                maxLength={255}
                autoComplete="off"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor="user-role" required>Role</FieldLabel>
              <Select
                required
                value={form.role}
                onValueChange={(value) =>
                  update("role", value as CreatableUserRole)
                }
              >
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_USER_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Student and applicant accounts use their own registration flows.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <FieldLabel htmlFor="user-password" required>Temporary password</FieldLabel>
              <PasswordInput
                id="user-password"
                required
                minLength={8}
                autoComplete="new-password"
                aria-describedby="user-password-requirements"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
              />
              <div id="user-password-requirements">
                <PasswordRequirements value={form.password} />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor="user-password-confirmation" required>
                Confirm password
              </FieldLabel>
              <PasswordInput
                id="user-password-confirmation"
                required
                minLength={8}
                autoComplete="new-password"
                aria-describedby="user-password-confirmation-feedback"
                aria-invalid={Boolean(form.passwordConfirmation) && !passwordsMatch}
                value={form.passwordConfirmation}
                onChange={(event) =>
                  update("passwordConfirmation", event.target.value)
                }
              />
              <p
                id="user-password-confirmation-feedback"
                role="status"
                className={`text-xs ${form.passwordConfirmation ? passwordsMatch ? "text-emerald-700 dark:text-emerald-300" : "text-destructive" : "text-muted-foreground"}`}
              >
                {form.passwordConfirmation
                  ? passwordsMatch
                    ? "Passwords match."
                    : "Passwords do not match. Re-enter the temporary password."
                  : "Re-enter the temporary password exactly as entered above."}
              </p>
            </div>
          </fieldset>
          {createUser.isError && (
            <p role="alert" className="text-destructive text-sm">
              {getErrorMessage(
                createUser.error,
                "We couldn't create the user account.",
              )}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createUser.isPending}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createUser.isPending || !canCreate}
            >
              {createUser.isPending && <Loader2Icon className="animate-spin" />}
              {createUser.isPending ? "Creating user…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SortHeader({
  column,
  title,
}: {
  column: Column<User, unknown>;
  title: string;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="hover:text-foreground -ml-1 inline-flex items-center gap-1 rounded px-1 whitespace-nowrap transition-colors"
    >
      {title}
      {sorted === "asc" ? (
        <ChevronUpIcon className="size-3.5" />
      ) : sorted === "desc" ? (
        <ChevronDownIcon className="size-3.5" />
      ) : (
        <ChevronsUpDownIcon className="size-3.5 opacity-40" />
      )}
    </button>
  );
}

function UsersPage() {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [creatingUser, setCreatingUser] = useState(false);
  const [statusTarget, setStatusTarget] = useState<User | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [verified, setVerified] = useState("all");
  const [joined, setJoined] = useState("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, role, verified, joined, status]);

  const sortState = sorting[0];
  const query = useUsers({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    role: role === "all" ? undefined : role,
    search: debouncedSearch || undefined,
    verified: verified === "all" ? undefined : verified,
    joined: joined === "all" ? undefined : joined,
    status: status === "all" ? undefined : status,
  });

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 py-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{row.original.name}</span>
              {row.original.id === currentUserId && (
                <span className="text-muted-foreground text-xs">You</span>
              )}
            </div>
            <span className="text-muted-foreground text-[0.8125rem]">
              {row.original.email}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => <SortHeader column={column} title="Role" />,
        cell: ({ row }) => <UserRoleBadge role={row.original.role} />,
      },
      {
        accessorKey: "isActive",
        header: "Account status",
        enableSorting: false,
        cell: ({ row }) => <UserStatusBadge isActive={row.original.isActive} />,
      },
      {
        id: "verified",
        header: "Email",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.emailVerified ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-500">
              <CheckCircle2Icon className="size-4" />
              Verified
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">Unverified</span>
          ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortHeader column={column} title="Joined" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <RowActions label={`Actions for ${row.original.name}`}>
            <DropdownMenuItem
              onClick={() => navigate(`/admin/users/${row.original.id}`)}
            >
              <Eye />
              View
            </DropdownMenuItem>
            {row.original.id !== currentUserId && (
              <DropdownMenuItem
                variant={row.original.isActive ? "destructive" : "default"}
                onClick={() => setStatusTarget(row.original)}
              >
                {row.original.isActive ? <UserXIcon /> : <UserCheckIcon />}
                {row.original.isActive ? "Deactivate" : "Reactivate"}
              </DropdownMenuItem>
            )}
          </RowActions>
        ),
      },
    ],
    [navigate, currentUserId],
  );

  // TanStack Table returns non-memoizable functions; the React Compiler lint
  // rule flags this by design — safe to ignore.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: query.data?.rows ?? [],
    columns,
    state: { sorting, pagination },
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    rowCount: query.data?.meta.total ?? 0,
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  });

  const filterPills: { value: RoleFilter; label: string }[] = [
    { value: "all", label: "All" },
    ...USER_ROLE_OPTIONS.map((option) => ({
      value: option.value as RoleFilter,
      label: option.label,
    })),
  ];

  const hasFilters = Boolean(search) || role !== "all" || verified !== "all" || joined !== "all" || status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeader title="Users" />
        </div>
        <Button onClick={() => setCreatingUser(true)}>
          <PlusIcon />
          Add user
        </Button>
      </div>

      {query.isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load users. Please try again.
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <TablePanel>
          <TableToolbar className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative w-full sm:min-w-56 sm:flex-1">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="pl-9"
              />
            </div>
            <Select value={role} onValueChange={(value) => setRole(value as RoleFilter)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role"><SelectValue /></SelectTrigger>
              <SelectContent>{filterPills.map((item) => <SelectItem key={item.value} value={item.value}>{item.value === "all" ? "All roles" : item.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={verified} onValueChange={setVerified}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Email verification"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All email statuses</SelectItem><SelectItem value="verified">Verified email</SelectItem><SelectItem value="unverified">Unverified email</SelectItem></SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Account status"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All account statuses</SelectItem><SelectItem value="active">Active accounts</SelectItem><SelectItem value="inactive">Inactive accounts</SelectItem></SelectContent>
            </Select>
            <Select value={joined} onValueChange={setJoined}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Joined date"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Any join date</SelectItem><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent>
            </Select>
            {hasFilters && <Button variant="outline" size="icon" className="size-9" aria-label="Clear filters" title="Clear filters" onClick={() => {setSearch("");setRole("all");setVerified("all");setJoined("all");setStatus("all");}}><FunnelXIcon /></Button>}
          </TableToolbar>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters ? "No users match your filters." : "No users yet."
            }
          />
        </TablePanel>
      )}
      <CreateUserDialog
        open={creatingUser}
        onOpenChange={setCreatingUser}
      />
      {statusTarget && (
        <UserStatusDialog user={statusTarget} onClose={() => setStatusTarget(null)} />
      )}
    </div>
  );
}

export default UsersPage;
