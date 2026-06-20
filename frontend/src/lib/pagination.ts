// Shared helpers for server-side paginated/searchable/sortable list endpoints.

export interface PageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface ListParams {
  page?: number;
  perPage?: number;
  sort?: string;
  dir?: "asc" | "desc";
  status?: string;
  role?: string;
  search?: string;
  category?: string;
  active?: string;
  termId?: number;
}

interface LaravelMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

// Shape of a Laravel paginated API resource response.
export interface LaravelPaginated<T> {
  data: T[];
  meta: LaravelMeta;
}

export function toPageMeta(meta: LaravelMeta): PageMeta {
  return {
    currentPage: meta.current_page,
    lastPage: meta.last_page,
    perPage: meta.per_page,
    total: meta.total,
    from: meta.from,
    to: meta.to,
  };
}

// Map our camelCase list params to the API's snake_case query string.
export function listParamsToQuery(params: ListParams) {
  return {
    page: params.page,
    per_page: params.perPage,
    sort: params.sort,
    dir: params.dir,
    status: params.status,
    role: params.role,
    search: params.search,
    category: params.category,
    active: params.active,
    term_id: params.termId,
  };
}
