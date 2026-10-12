export const STUDENT_DROPPING_PATH = '/portal/programs?section=dropping';

export function studentDroppingPath(id?: number | string) {
  if (id == null) return STUDENT_DROPPING_PATH;
  return id === 'new' ? `${STUDENT_DROPPING_PATH}&request=new` : `/portal/dropping-requests/${encodeURIComponent(id)}`;
}

export const NEW_STUDENT_DROPPING_PATH = studentDroppingPath('new');
