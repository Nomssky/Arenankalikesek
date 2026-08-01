import {
  DEFAULT_BOOKING_SETTINGS,
  type BookingSettingMap,
} from '@/lib/booking-domain'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'

export interface BookingSettingRow {
  key: string
  group_name: string
  label: string
  value_numeric: number | null
  unit: string
  editable: boolean
  updated_at?: string
}

export async function loadBookingSettingRows(): Promise<BookingSettingRow[]> {
  if (!isSupabaseConfigured()) {
    return Object.entries(DEFAULT_BOOKING_SETTINGS).map(([key, value_numeric]) => ({
      key,
      group_name: key.split('.')[0],
      label: key,
      value_numeric,
      unit: '',
      editable: true,
    }))
  }

  const { data, error } = await getSupabaseAdmin()
    .from('booking_settings')
    .select('key, group_name, label, value_numeric, unit, editable, updated_at')
    .order('group_name')
    .order('key')

  if (error) {
    console.error('Load booking settings error:', error)
    return Object.entries(DEFAULT_BOOKING_SETTINGS).map(([key, value_numeric]) => ({
      key,
      group_name: key.split('.')[0],
      label: key,
      value_numeric,
      unit: '',
      editable: true,
    }))
  }
  return data || []
}

export async function loadBookingSettings(): Promise<BookingSettingMap> {
  const rows = await loadBookingSettingRows()
  return {
    ...DEFAULT_BOOKING_SETTINGS,
    ...Object.fromEntries(rows.map((row) => [row.key, row.value_numeric])),
  }
}
