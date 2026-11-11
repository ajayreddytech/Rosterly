export type Role = "volunteer" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
}

export interface Shift {
  id: string;
  department_id: string;
  title: string;
  start_time: string;
  end_time: string;
  max_volunteers: number;
  created_at: string;
}

export interface Assignment {
  id: string;
  shift_id: string;
  user_id: string;
  assigned_at: string;
}

/** Row from the public.shift_capacity view (counts only, no personal data). */
export interface ShiftCapacity {
  shift_id: string;
  department_id: string;
  max_volunteers: number;
  booked_count: number;
  remaining_slots: number;
}

/** Admin attendance row: an assignment joined with the volunteer's profile. */
export interface AttendanceRow {
  id: string;
  shift_id: string;
  assigned_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

export type CapacityMap = Record<string, ShiftCapacity>;
