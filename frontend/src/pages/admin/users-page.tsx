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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { UserRoleBadge } from "@/features/users/components/user-role-badge";
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

  function update<K extends keyof CreateUserForm>(
    field: K,
    value: CreateUserForm[K],
  ) {
    createUser.reset();
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!createUser.isPending) {
          if (!next) {
            setForm(EMPTY_USER_FORM);
            createUser.reset();
          }
          onOpenChange(next);
        }
      }}
    >
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
            if (!role) return;

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
              <Label htmlFor="user-first-name">First name</Label>
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
              <Label htmlFor="user-middle-name">Middle name</Label>
              <Input
                id="user-middle-name"
                maxLength={100}
                value={form.middleName}
                onChange={(event) => update("middleName", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="user-last-name">Last name</Label>
              <Input
                id="user-last-name"
                required
                maxLength={100}
                value={form.lastName}
                onChange={(event) => update("lastName", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="user-email">Email</Label>
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
              <Label htmlFor="user-role">Role</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Temporary password</Label>
              <Input
                id="user-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-password-confirmation">
                Confirm password
              </Label>
              <Input
                id="user-password-confirmation"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.passwordConfirmation}
                onChange={(event) =>
                  update("passwordConfirmation", event.target.value)
                }
              />
            </div>
          </fieldset>
          <p className="text-muted-foreground text-xs">
            Use at least 8 characters with an uppercase letter and a number.
          </p>
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
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createUser.isPending ||
                !form.firstName.trim() ||
                !form.lastName.trim() ||
                !form.email.trim() ||
                !form.role ||
                !form.password ||
                form.password !== form.passwordConfirmation
              }
            >
              {createUser.isPending && <Loader2Icon className="animate-spin" />}
              Create user
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
  const [creatingUser, setCreatingUser] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [role, setRole] = useState<RoleFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, role]);

  const sortState = sorting[0];
  const query = useUsers({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    role: role === "all" ? undefined : role,
    search: debouncedSearch || undefined,
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
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground text-xs">
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
          <RowActions>
            <DropdownMenuItem
              onClick={() => navigate(`/admin/users/${row.original.id}`)}
            >
              <Eye />
              View
            </DropdownMenuItem>
          </RowActions>
        ),
      },
    ],
    [navigate],
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

  const hasFilters = Boolean(debouncedSearch) || role !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">
            Monitor accounts and provision administrators, cashiers, and teachers.
          </p>
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
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filterPills.map((pill) => {
                const active = role === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setRole(pill.value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters ? "No users match your filters." : "No users yet."
            }
          />
        </div>
      )}
      <CreateUserDialog
        open={creatingUser}
        onOpenChange={setCreatingUser}
      />
    </div>
  );
}

export default UsersPage;
