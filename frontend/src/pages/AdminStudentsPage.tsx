import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  GripVertical,
  Pin,
  PinOff,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type StudentRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  stage: string
  payment_status: string
  pending_amount: number
  primary_batch_code: string | null
  trainer_name: string | null
  gender: string | null
  location: string | null
  previous_job_role: string | null
  experience_years: number | null
  enrollment_date: string | null
  attendance_pct: number | null
  progress_pct: number | null
  trainer_rating: number | null
  course_fee: number
  amount_paid: number
  no_of_applications: number
  no_of_interviews: number
  offers_received: number
}

type FilterOption = {
  label: string
  value: string
}

type ColumnKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'primary_batch_code'
  | 'stage'
  | 'trainer_name'
  | 'payment_status'
  | 'pending_amount'
  | 'course_fee'
  | 'amount_paid'
  | 'gender'
  | 'location'
  | 'previous_job_role'
  | 'experience_years'
  | 'enrollment_date'
  | 'attendance_pct'
  | 'progress_pct'
  | 'trainer_rating'
  | 'no_of_applications'
  | 'no_of_interviews'
  | 'offers_received'

type ColumnDef = {
  key: ColumnKey
  label: string
  width: number
}

type SimpleBatch = {
  id: string
  batch_code: string
  trainer_id: string | null
}

type SimpleTrainer = {
  id: string
  trainer_name: string
}

const defaultVisibleColumns: ColumnKey[] = [
  'name',
  'stage',
  'primary_batch_code',
  'phone',
  'progress_pct',
  'attendance_pct',
  'payment_status',
]

type AdminStudentsPageProps = {
  onlyBatchId?: string
}

type BulkFieldKey =
  | 'stage'
  | 'payment_status'
  | 'gender'
  | 'location'
  | 'previous_job_role'
  | 'experience_years'
  | 'attendance_pct'
  | 'progress_pct'
  | 'trainer_rating'
  | 'no_of_applications'
  | 'no_of_interviews'
  | 'offers_received'

type BulkFieldConfig = {
  key: BulkFieldKey
  label: string
  inputType: 'select' | 'text' | 'number'
  options?: Array<{ label: string; value: string }>
}

const bulkFieldConfigs: BulkFieldConfig[] = [
  {
    key: 'stage',
    label: 'Stage',
    inputType: 'select',
    options: [
      { label: 'Training', value: 'training' },
      { label: 'Trial Classes', value: 'trial_classes' },
      { label: 'Mock Interviews', value: 'mock_interviews' },
      { label: 'Searching for Jobs', value: 'searching_for_jobs' },
      { label: 'Taking Interviews', value: 'taking_interviews' },
      { label: 'Placed', value: 'placed' },
    ],
  },
  {
    key: 'payment_status',
    label: 'Payment Status',
    inputType: 'select',
    options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Partial', value: 'partial' },
      { label: 'Paid', value: 'paid' },
    ],
  },
  {
    key: 'gender',
    label: 'Gender',
    inputType: 'select',
    options: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Other', value: 'other' },
    ],
  },
  { key: 'location', label: 'Location', inputType: 'text' },
  { key: 'previous_job_role', label: 'Previous Job Role', inputType: 'text' },
  { key: 'experience_years', label: 'Experience (years)', inputType: 'number' },
  { key: 'attendance_pct', label: 'Attendance %', inputType: 'number' },
  { key: 'progress_pct', label: 'Progress %', inputType: 'number' },
  { key: 'trainer_rating', label: 'Trainer Rating', inputType: 'number' },
  { key: 'no_of_applications', label: 'No. of Applications', inputType: 'number' },
  { key: 'no_of_interviews', label: 'No. of Interviews', inputType: 'number' },
  { key: 'offers_received', label: 'Offers Received', inputType: 'number' },
]

export function AdminStudentsPage({ onlyBatchId }: AdminStudentsPageProps = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [allBatches, setAllBatches] = useState<SimpleBatch[]>([])
  const [allTrainers, setAllTrainers] = useState<SimpleTrainer[]>([])
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [columnsOpen, setColumnsOpen] = useState(false)
  const columnsRef = useRef<HTMLDivElement | null>(null)

  const allColumns = useMemo<ColumnDef[]>(
    () =>
      [
        { key: 'name', label: 'Student', width: 180 },
        { key: 'email', label: 'Email', width: 230 },
        { key: 'phone', label: 'Phone', width: 140 },
        { key: 'primary_batch_code', label: 'Batch', width: 220 },
        { key: 'stage', label: 'Stage', width: 140 },
        { key: 'trainer_name', label: 'Trainer', width: 130 },
        { key: 'payment_status', label: 'Payment', width: 130 },
        { key: 'pending_amount', label: 'Pending', width: 120 },
        { key: 'course_fee', label: 'Course Fee', width: 130 },
        { key: 'amount_paid', label: 'Amount Paid', width: 130 },
        { key: 'gender', label: 'Gender', width: 110 },
        { key: 'location', label: 'Location', width: 130 },
        { key: 'previous_job_role', label: 'Previous Role', width: 170 },
        { key: 'experience_years', label: 'Experience', width: 120 },
        { key: 'enrollment_date', label: 'Enrollment Date', width: 150 },
        { key: 'attendance_pct', label: 'Attendance %', width: 120 },
        { key: 'progress_pct', label: 'Progress %', width: 120 },
        { key: 'trainer_rating', label: 'Trainer Rating', width: 130 },
        { key: 'no_of_applications', label: 'Applications', width: 120 },
        { key: 'no_of_interviews', label: 'Interviews', width: 120 },
        { key: 'offers_received', label: 'Offers', width: 100 },
      ],
    [],
  )

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>([
    ...defaultVisibleColumns,
  ])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(allColumns.map((column) => [column.key, column.width])),
  )
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    const remaining = allColumns
      .map((column) => column.key)
      .filter((key) => !defaultVisibleColumns.includes(key))
    return [...defaultVisibleColumns, ...remaining]
  })
  const [pinnedColumns, setPinnedColumns] = useState<ColumnKey[]>(['name'])
  const [draggingColumn, setDraggingColumn] = useState<ColumnKey | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkField, setBulkField] = useState<BulkFieldKey>('stage')
  const [bulkValue, setBulkValue] = useState('training')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formData, setFormData] = useState({
    student_name: '',
    batch_id: '',
    phone: '',
    payment_status: 'pending',
    email: '',
    trainer_id: '',
    course_fee: '',
    amount_paid: '',
    enrollment_date: '',
    gender: 'male',
  })
  const [sortState, setSortState] = useState<{
    key: ColumnKey | null
    direction: 'none' | 'asc' | 'desc'
  }>({
    key: null,
    direction: 'none',
  })
  const resizeStateRef = useRef<{
    key: ColumnKey
    startX: number
    startWidth: number
  } | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!columnsOpen) return
      const target = event.target as Node
      if (columnsRef.current && !columnsRef.current.contains(target)) {
        setColumnsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [columnsOpen])

  useEffect(() => {
    if (!formData.batch_id || !formData.trainer_id) return
    const selectedBatch = allBatches.find((batch) => batch.id === formData.batch_id)
    if (selectedBatch && selectedBatch.trainer_id !== formData.trainer_id) {
      setFormData((prev) => ({ ...prev, batch_id: '' }))
    }
  }, [formData.batch_id, formData.trainer_id, allBatches])

  useEffect(() => {
    const validIds = new Set(students.map((student) => student.id))
    setSelectedStudentIds((prev) => prev.filter((id) => validIds.has(id)))
  }, [students])

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true)
      setError('')

      const studentBatchesQuery = supabase
        .from('student_batches')
        .select('student_id,batch_id,joined_at')
        .eq('is_active', true)
      if (onlyBatchId) {
        studentBatchesQuery.eq('batch_id', onlyBatchId)
      }

      const [{ data: studentRows, error: studentError }, { data: sbRows, error: sbError }] =
        await Promise.all([
          supabase
            .from('students')
            .select(
              'id,student_name,email,phone,stage,payment_status,pending_amount,course_fee,amount_paid,gender,location,previous_job_role,experience_years,enrollment_date,attendance_pct,progress_pct,trainer_rating,no_of_applications,no_of_interviews,offers_received',
            )
            .order('student_name', { ascending: true }),
          studentBatchesQuery,
        ])

      if (studentError || sbError) {
        setError(studentError?.message ?? sbError?.message ?? 'Failed to load students.')
        setLoading(false)
        return
      }

      const { data: batchRows, error: batchError } = await supabase
        .from('batches')
        .select('id,batch_code,trainer_id')
        .order('batch_code', { ascending: true })

      if (batchError) {
        setError(batchError.message)
        setLoading(false)
        return
      }

      const { data: trainerRows, error: trainerError } = await supabase
        .from('trainers')
        .select('id,trainer_name')
        .order('trainer_name', { ascending: true })

      if (trainerError) {
        setError(trainerError.message)
        setLoading(false)
        return
      }

      const batchById = new Map(
        (batchRows ?? []).map((row) => [row.id, row]),
      )
      const trainerNameById = new Map(
        (trainerRows ?? []).map((row) => [row.id, row.trainer_name]),
      )

      setAllBatches(
        (batchRows ?? []).map((row) => ({
          id: row.id,
          batch_code: row.batch_code,
          trainer_id: row.trainer_id,
        })),
      )
      setAllTrainers(
        (trainerRows ?? []).map((row) => ({
          id: row.id,
          trainer_name: row.trainer_name,
        })),
      )

      const firstBatchByStudent = new Map<string, { batch_id: string; joined_at: string | null }>()
      for (const row of sbRows ?? []) {
        const existing = firstBatchByStudent.get(row.student_id)
        if (!existing || (row.joined_at && row.joined_at < (existing.joined_at ?? ''))) {
          firstBatchByStudent.set(row.student_id, {
            batch_id: row.batch_id,
            joined_at: row.joined_at ?? null,
          })
        }
      }

      const rows: StudentRow[] = (studentRows ?? [])
        .map((student) => {
          const batchInfo = firstBatchByStudent.get(student.id)
          const batch = batchInfo ? batchById.get(batchInfo.batch_id) : undefined
          const trainerName =
            batch && batch.trainer_id
              ? trainerNameById.get(batch.trainer_id) ?? null
              : null

          return {
            id: student.id,
            name: student.student_name,
            email: student.email,
            phone: student.phone,
            stage: student.stage,
            payment_status: student.payment_status,
            pending_amount: student.pending_amount ?? 0,
            primary_batch_code: batch?.batch_code ?? null,
            trainer_name: trainerName,
            gender: student.gender ?? null,
            location: student.location ?? null,
            previous_job_role: student.previous_job_role ?? null,
            experience_years: student.experience_years ?? null,
            enrollment_date: student.enrollment_date ?? null,
            attendance_pct: student.attendance_pct ?? null,
            progress_pct: student.progress_pct ?? null,
            trainer_rating: student.trainer_rating ?? null,
            course_fee: student.course_fee ?? 0,
            amount_paid: student.amount_paid ?? 0,
            no_of_applications: student.no_of_applications ?? 0,
            no_of_interviews: student.no_of_interviews ?? 0,
            offers_received: student.offers_received ?? 0,
          }
        })
        .filter((row) => (onlyBatchId ? Boolean(row.primary_batch_code) : true))

      setStudents(rows)
      setLoading(false)
    }

    void loadStudents()
  }, [onlyBatchId])

  const stageOptions: FilterOption[] = useMemo(
    () => [
      { label: 'All stages', value: 'all' },
      { label: 'Training', value: 'training' },
      { label: 'Trial Classes', value: 'trial_classes' },
      { label: 'Mock Interviews', value: 'mock_interviews' },
      { label: 'Searching for Jobs', value: 'searching_for_jobs' },
      { label: 'Taking Interviews', value: 'taking_interviews' },
      { label: 'Placed', value: 'placed' },
    ],
    [],
  )

  const batchOptions: FilterOption[] = useMemo(() => {
    const codes = Array.from(
      new Set(
        students
          .map((s) => s.primary_batch_code)
          .filter((code): code is string => Boolean(code)),
      ),
    )
    return [{ label: 'All batches', value: 'all' }].concat(
      codes.map((code) => ({ label: code, value: code })),
    )
  }, [students])

  const paymentOptions: FilterOption[] = useMemo(
    () => [
      { label: 'All payments', value: 'all' },
      { label: 'Pending', value: 'pending' },
      { label: 'Partial', value: 'partial' },
      { label: 'Paid', value: 'paid' },
    ],
    [],
  )

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const text = `${s.name} ${s.email ?? ''} ${s.phone ?? ''} ${
        s.primary_batch_code ?? ''
      } ${s.trainer_name ?? ''}`.toLowerCase()
      const searchOk = text.includes(search.toLowerCase())

      const stageOk = stageFilter === 'all' || s.stage === stageFilter
      const batchOk =
        batchFilter === 'all' || s.primary_batch_code === batchFilter
      const paymentOk =
        paymentFilter === 'all' || s.payment_status === paymentFilter

      return searchOk && stageOk && batchOk && paymentOk
    })
  }, [students, search, stageFilter, batchFilter, paymentFilter])

  const sortedStudents = useMemo(() => {
    if (!sortState.key || sortState.direction === 'none') return filteredStudents

    const key = sortState.key
    const dir = sortState.direction === 'asc' ? 1 : -1

    const getValue = (student: StudentRow) => {
      switch (key) {
        case 'name':
          return student.name ?? ''
        case 'email':
          return student.email ?? ''
        case 'phone':
          return student.phone ?? ''
        case 'primary_batch_code':
          return student.primary_batch_code ?? ''
        case 'stage':
          return student.stage ?? ''
        case 'trainer_name':
          return student.trainer_name ?? ''
        case 'payment_status':
          return student.payment_status ?? ''
        case 'pending_amount':
          return student.pending_amount ?? 0
        case 'course_fee':
          return student.course_fee ?? 0
        case 'amount_paid':
          return student.amount_paid ?? 0
        case 'gender':
          return student.gender ?? ''
        case 'location':
          return student.location ?? ''
        case 'previous_job_role':
          return student.previous_job_role ?? ''
        case 'experience_years':
          return student.experience_years ?? -1
        case 'enrollment_date':
          return student.enrollment_date ?? ''
        case 'attendance_pct':
          return student.attendance_pct ?? -1
        case 'progress_pct':
          return student.progress_pct ?? -1
        case 'trainer_rating':
          return student.trainer_rating ?? -1
        case 'no_of_applications':
          return student.no_of_applications ?? 0
        case 'no_of_interviews':
          return student.no_of_interviews ?? 0
        case 'offers_received':
          return student.offers_received ?? 0
        default:
          return ''
      }
    }

    const sorted = [...filteredStudents]
    sorted.sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)

      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir
      }
      return String(av).localeCompare(String(bv), undefined, {
        sensitivity: 'base',
      }) * dir
    })
    return sorted
  }, [filteredStudents, sortState])

  const currentBulkConfig = useMemo(
    () => bulkFieldConfigs.find((config) => config.key === bulkField) ?? bulkFieldConfigs[0],
    [bulkField],
  )

  const visibleStudentIds = useMemo(
    () => sortedStudents.map((student) => student.id),
    [sortedStudents],
  )
  const selectedVisibleCount = useMemo(
    () => visibleStudentIds.filter((id) => selectedStudentIds.includes(id)).length,
    [selectedStudentIds, visibleStudentIds],
  )
  const allVisibleSelected =
    visibleStudentIds.length > 0 && selectedVisibleCount === visibleStudentIds.length
  const hasPartialVisibleSelection =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleStudentIds.length

  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = hasPartialVisibleSelection
  }, [hasPartialVisibleSelection])

  const toggleColumn = (key: ColumnKey) => {
    if (key === 'name') return
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
    setPinnedColumns((prev) =>
      visibleColumns.includes(key) ? prev.filter((c) => c !== key) : prev,
    )
  }

  const startResize = (key: ColumnKey, event: ReactMouseEvent) => {
    event.preventDefault()
    resizeStateRef.current = {
      key,
      startX: event.clientX,
      startWidth: columnWidths[key] ?? 120,
    }

    const onMove = (moveEvent: MouseEvent) => {
      const state = resizeStateRef.current
      if (!state) return
      const delta = moveEvent.clientX - state.startX
      setColumnWidths((prev) => ({
        ...prev,
        [state.key]: Math.max(90, state.startWidth + delta),
      }))
    }

    const onUp = () => {
      resizeStateRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const reorderColumn = (dragKey: ColumnKey, targetKey: ColumnKey) => {
    if (dragKey === targetKey || dragKey === 'name') return
    setColumnOrder((prev) => {
      const from = prev.indexOf(dragKey)
      const to = prev.indexOf(targetKey)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      next.splice(from, 1)
      const insertAtRaw = from < to ? to - 1 : to
      const insertAt = Math.max(1, insertAtRaw)
      next.splice(insertAt, 0, dragKey)
      return next
    })
  }

  const togglePinned = (key: ColumnKey) => {
    if (key === 'name') return
    setPinnedColumns((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  const toggleSort = (key: ColumnKey) => {
    setSortState((prev) => {
      if (prev.key !== key) {
        return { key, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' }
      }
      if (prev.direction === 'desc') {
        return { key: null, direction: 'none' }
      }
      return { key, direction: 'asc' }
    })
  }

  const getSortIcon = (key: ColumnKey) => {
    if (sortState.key !== key || sortState.direction === 'none') {
      return <ArrowUpDown size={12} />
    }
    if (sortState.direction === 'asc') return <ArrowUp size={12} />
    return <ArrowDown size={12} />
  }

  const toggleStudentSelection = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      if (checked) {
        if (prev.includes(studentId)) return prev
        return [...prev, studentId]
      }
      return prev.filter((id) => id !== studentId)
    })
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedStudentIds((prev) => {
      if (checked) {
        const next = new Set(prev)
        for (const id of visibleStudentIds) next.add(id)
        return Array.from(next)
      }
      const visibleSet = new Set(visibleStudentIds)
      return prev.filter((id) => !visibleSet.has(id))
    })
  }

  const openBulkUpdate = () => {
    setBulkError('')
    setBulkField('stage')
    setBulkValue('training')
    setIsBulkOpen(true)
  }

  const handleBulkFieldChange = (value: BulkFieldKey) => {
    setBulkField(value)
    const config = bulkFieldConfigs.find((field) => field.key === value)
    if (!config) return
    if (config.inputType === 'select' && config.options?.length) {
      setBulkValue(config.options[0].value)
    } else {
      setBulkValue('')
    }
  }

  const saveBulkUpdate = async (event: FormEvent) => {
    event.preventDefault()
    setBulkError('')

    if (!selectedStudentIds.length) {
      setBulkError('Select at least one student.')
      return
    }
    if (!bulkValue.trim()) {
      setBulkError('Please enter a value to update.')
      return
    }

    let parsedValue: string | number = bulkValue.trim()
    if (currentBulkConfig.inputType === 'number') {
      const numberValue = Number(bulkValue)
      if (!Number.isFinite(numberValue)) {
        setBulkError('Please enter a valid numeric value.')
        return
      }
      parsedValue = numberValue
    }

    const updatePayload = {
      [bulkField]: parsedValue,
    }

    setBulkSaving(true)
    const { error: updateError } = await supabase
      .from('students')
      .update(updatePayload)
      .in('id', selectedStudentIds)

    if (updateError) {
      setBulkSaving(false)
      setBulkError(updateError.message)
      return
    }

    setStudents((prev) =>
      prev.map((student) =>
        selectedStudentIds.includes(student.id)
          ? ({ ...student, [bulkField]: parsedValue } as StudentRow)
          : student,
      ),
    )
    setBulkSaving(false)
    setIsBulkOpen(false)
    setSelectedStudentIds([])
  }

  const formatStage = (value: string) => value.replaceAll('_', ' ')

  const stageBadgeVariant = (value: string) => {
    switch (value) {
      case 'placed':
        return 'badge-green'
      case 'taking_interviews':
        return 'badge-purple'
      case 'searching_for_jobs':
        return 'badge-blue'
      case 'mock_interviews':
        return 'badge-yellow'
      case 'trial_classes':
        return 'badge-orange'
      default:
        return 'badge-gray'
    }
  }

  const paymentBadgeVariant = (value: string) => {
    switch (value) {
      case 'paid':
        return 'badge-green'
      case 'partial':
        return 'badge-yellow'
      case 'pending':
        return 'badge-red'
      default:
        return 'badge-gray'
    }
  }

  const renderCell = (student: StudentRow, key: ColumnKey) => {
    switch (key) {
      case 'name':
        return <p className="class-title">{student.name}</p>
      case 'email':
        return <p className="class-sub">{student.email ?? '-'}</p>
      case 'phone':
        return <p className="class-sub">{student.phone ?? '-'}</p>
      case 'primary_batch_code':
        return <p className="class-title">{student.primary_batch_code ?? 'Not assigned'}</p>
      case 'stage':
        return (
          <span className={`tag-pill ${stageBadgeVariant(student.stage)}`}>
            {formatStage(student.stage)}
          </span>
        )
      case 'trainer_name':
        return <p className="class-sub">{student.trainer_name ?? '-'}</p>
      case 'payment_status':
        return (
          <span className={`tag-pill ${paymentBadgeVariant(student.payment_status)}`}>
            {student.payment_status}
          </span>
        )
      case 'pending_amount':
        return (
          <p className="class-sub">
            {student.pending_amount > 0
              ? `₹${student.pending_amount.toLocaleString('en-IN')}`
              : '₹0'}
          </p>
        )
      case 'course_fee':
        return <p className="class-sub">₹{student.course_fee.toLocaleString('en-IN')}</p>
      case 'amount_paid':
        return <p className="class-sub">₹{student.amount_paid.toLocaleString('en-IN')}</p>
      case 'gender':
        return <p className="class-sub">{student.gender ?? '-'}</p>
      case 'location':
        return <p className="class-sub">{student.location ?? '-'}</p>
      case 'previous_job_role':
        return <p className="class-sub">{student.previous_job_role ?? '-'}</p>
      case 'experience_years':
        return <p className="class-sub">{student.experience_years ?? '-'}</p>
      case 'enrollment_date':
        return <p className="class-sub">{student.enrollment_date ?? '-'}</p>
      case 'attendance_pct':
        return (
          <p className="class-sub">
            {student.attendance_pct ?? '-'}
            {typeof student.attendance_pct === 'number' ? '%' : ''}
          </p>
        )
      case 'progress_pct':
        return (
          <p className="class-sub">
            {student.progress_pct ?? '-'}
            {typeof student.progress_pct === 'number' ? '%' : ''}
          </p>
        )
      case 'trainer_rating':
        return <p className="class-sub">{student.trainer_rating ?? '-'}</p>
      case 'no_of_applications':
        return <p className="class-sub">{student.no_of_applications ?? 0}</p>
      case 'no_of_interviews':
        return <p className="class-sub">{student.no_of_interviews ?? 0}</p>
      case 'offers_received':
        return <p className="class-sub">{student.offers_received ?? 0}</p>
      default:
        return null
    }
  }

  const columnByKey = useMemo(
    () =>
      new Map<ColumnKey, ColumnDef>(
        allColumns.map((column) => [column.key, column]),
      ),
    [allColumns],
  )
  const orderedVisibleKeys = columnOrder
    .filter((key) => visibleColumns.includes(key))
  const orderedPinnedKeys = orderedVisibleKeys.filter((key) =>
    pinnedColumns.includes(key),
  )
  const orderedScrollableKeys = orderedVisibleKeys.filter(
    (key) => !pinnedColumns.includes(key),
  )
  const activeColumns = [...orderedPinnedKeys, ...orderedScrollableKeys]
    .map((key) => columnByKey.get(key))
    .filter((column): column is ColumnDef => Boolean(column))
  const selectionColumnWidth = 52

  const pinnedLeftMap = useMemo(() => {
    let left = selectionColumnWidth
    const result: Record<string, number> = {}
    for (const key of orderedPinnedKeys) {
      const width = columnWidths[key] ?? 120
      result[key] = left
      left += width
    }
    return result
  }, [orderedPinnedKeys, columnWidths, selectionColumnWidth])

  const hiddenColumns = allColumns.filter(
    (column) => !visibleColumns.includes(column.key),
  )
  const fixedBatch = onlyBatchId
    ? allBatches.find((batch) => batch.id === onlyBatchId) ?? null
    : null
  const batchesForTrainer = allBatches.filter(
    (batch) =>
      (!formData.trainer_id || batch.trainer_id === formData.trainer_id) &&
      (!onlyBatchId || batch.id === onlyBatchId),
  )
  const tableMinWidth = activeColumns.reduce(
    (sum, column) => sum + (columnWidths[column.key] ?? column.width),
    selectionColumnWidth,
  )

  const createStudent = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')

    if (
      !formData.student_name ||
      !formData.batch_id ||
      !formData.phone ||
      !formData.payment_status ||
      !formData.email ||
      !formData.trainer_id ||
      !formData.course_fee ||
      !formData.amount_paid ||
      !formData.enrollment_date ||
      !formData.gender
    ) {
      setFormError('Please fill all required fields.')
      return
    }

    const selectedBatch = allBatches.find((batch) => batch.id === formData.batch_id)
    if (!selectedBatch) {
      setFormError('Please choose a valid batch.')
      return
    }
    if (selectedBatch.trainer_id !== formData.trainer_id) {
      setFormError('Selected trainer does not belong to selected batch.')
      return
    }

    const courseFee = Number(formData.course_fee)
    const amountPaid = Number(formData.amount_paid)
    if (!Number.isFinite(courseFee) || !Number.isFinite(amountPaid)) {
      setFormError('Course fee and amount paid must be valid numbers.')
      return
    }

    setFormSaving(true)

    const { data: createdStudent, error: createError } = await supabase
      .from('students')
      .insert({
        student_name: formData.student_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        gender: formData.gender,
        stage: 'training',
        payment_status: formData.payment_status,
        course_fee: courseFee,
        amount_paid: amountPaid,
        enrollment_date: formData.enrollment_date,
      })
      .select('*')
      .single()

    if (createError || !createdStudent) {
      setFormSaving(false)
      setFormError(createError?.message ?? 'Failed to create student.')
      return
    }

    const { error: mapError } = await supabase.from('student_batches').insert({
      student_id: createdStudent.id,
      batch_id: formData.batch_id,
      joined_at: formData.enrollment_date,
      is_active: true,
    })

    if (mapError) {
      setFormSaving(false)
      setFormError(mapError.message)
      return
    }

    const trainerName =
      allTrainers.find((trainer) => trainer.id === formData.trainer_id)
        ?.trainer_name ?? null

    setStudents((prev) => [
      {
        id: createdStudent.id,
        name: createdStudent.student_name,
        email: createdStudent.email,
        phone: createdStudent.phone,
        stage: createdStudent.stage,
        payment_status: createdStudent.payment_status,
        pending_amount: createdStudent.pending_amount ?? Math.max(courseFee - amountPaid, 0),
        primary_batch_code: selectedBatch.batch_code,
        trainer_name: trainerName,
        gender: createdStudent.gender ?? null,
        location: createdStudent.location ?? null,
        previous_job_role: createdStudent.previous_job_role ?? null,
        experience_years: createdStudent.experience_years ?? null,
        enrollment_date: createdStudent.enrollment_date ?? null,
        attendance_pct: createdStudent.attendance_pct ?? null,
        progress_pct: createdStudent.progress_pct ?? null,
        trainer_rating: createdStudent.trainer_rating ?? null,
        course_fee: createdStudent.course_fee ?? courseFee,
        amount_paid: createdStudent.amount_paid ?? amountPaid,
        no_of_applications: createdStudent.no_of_applications ?? 0,
        no_of_interviews: createdStudent.no_of_interviews ?? 0,
        offers_received: createdStudent.offers_received ?? 0,
      },
      ...prev,
    ])

    setFormSaving(false)
    setIsCreateOpen(false)
    setFormData({
      student_name: '',
      batch_id: '',
      phone: '',
      payment_status: 'pending',
      email: '',
      trainer_id: '',
      course_fee: '',
      amount_paid: '',
      enrollment_date: '',
      gender: 'male',
    })
  }

  if (loading) {
    return (
      <section className={`panel ${onlyBatchId ? 'batch-students-panel' : ''}`}>
        <p className="muted-dark">Loading students...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
      </section>
    )
  }

  const renderColumnsMenu = () => (
    <div className="columns-menu" ref={columnsRef}>
      <button
        type="button"
        className="columns-btn"
        onClick={() => setColumnsOpen((v) => !v)}
      >
        Columns
      </button>
      {columnsOpen ? (
        <div className="columns-popover">
          <div className="columns-section">
            <p className="columns-section-title">
              Pinned Columns {orderedPinnedKeys.length}/{orderedVisibleKeys.length}
            </p>
            {orderedPinnedKeys.map((key) => {
              const column = columnByKey.get(key)
              if (!column) return null
              const canDrag = key !== 'name'
              return (
                <div
                  key={column.key}
                  className={`columns-draggable-item ${
                    draggingColumn === column.key ? 'is-dragging' : ''
                  }`}
                  draggable={canDrag}
                  onDragStart={() => setDraggingColumn(column.key)}
                  onDragEnd={() => setDraggingColumn(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingColumn) reorderColumn(draggingColumn, column.key)
                    setDraggingColumn(null)
                  }}
                >
                  <span className="drag-handle">
                    <GripVertical size={14} />
                  </span>
                  <span className="columns-item-label">{column.label}</span>
                  <div className="columns-item-actions">
                    <button
                      type="button"
                      title="Unpin column"
                      disabled={column.key === 'name'}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        togglePinned(column.key)
                      }}
                    >
                      <Pin size={13} />
                    </button>
                    <button
                      type="button"
                      title="Hide column"
                      disabled={column.key === 'name'}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleColumn(column.key)
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="columns-section">
            <p className="columns-section-title">Scrollable Columns</p>
            {orderedScrollableKeys.map((key) => {
              const column = columnByKey.get(key)
              if (!column) return null
              return (
                <div
                  key={column.key}
                  className={`columns-draggable-item ${
                    draggingColumn === column.key ? 'is-dragging' : ''
                  }`}
                  draggable
                  onDragStart={() => setDraggingColumn(column.key)}
                  onDragEnd={() => setDraggingColumn(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingColumn) reorderColumn(draggingColumn, column.key)
                    setDraggingColumn(null)
                  }}
                >
                  <span className="drag-handle">
                    <GripVertical size={14} />
                  </span>
                  <span className="columns-item-label">{column.label}</span>
                  <div className="columns-item-actions">
                    <button
                      type="button"
                      title="Pin column"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        togglePinned(column.key)
                      }}
                    >
                      <PinOff size={13} />
                    </button>
                    <button
                      type="button"
                      title="Hide column"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleColumn(column.key)
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {hiddenColumns.length ? (
            <div className="columns-section">
              <p className="columns-section-title">Hidden Columns</p>
              {hiddenColumns.map((column) => (
                <div key={column.key} className="columns-draggable-item hidden-col">
                  <span className="columns-item-label">{column.label}</span>
                  <div className="columns-item-actions">
                    <button
                      type="button"
                      title="Show column"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleColumn(column.key)
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      <section className="panel">
        {!onlyBatchId ? (
          <div className="panel-top">
            <div>
              <h3>Students</h3>
              <p className="muted-dark">
                View all students, their batches, stages, and payments.
              </p>
            </div>
            <div className="panel-actions">
              <div className="search-box">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {renderColumnsMenu()}
            </div>
          </div>
        ) : null}

        <div className={`filters-row ${onlyBatchId ? 'filters-row-tight' : ''}`}>
          <label className="filter-select">
            <span>Stage</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              {stageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {!onlyBatchId ? (
            <label className="filter-select">
              <span>Batch</span>
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              >
                {batchOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="filter-select">
            <span>Payment</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              {paymentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {onlyBatchId ? renderColumnsMenu() : null}
          <button
            type="button"
            className="create-student-btn"
            onClick={() => {
              setFormError('')
              if (onlyBatchId) {
                setFormData((prev) => ({ ...prev, batch_id: onlyBatchId }))
              }
              setIsCreateOpen(true)
            }}
          >
            <UserPlus size={14} />
            Add New Student
          </button>
        </div>
        {selectedStudentIds.length ? (
          <div className="bulk-actions-bar">
            <p>{selectedStudentIds.length} students selected</p>
            <div className="bulk-actions-right">
              <button type="button" className="bulk-update-btn" onClick={openBulkUpdate}>
                Bulk Update
              </button>
              <button
                type="button"
                className="bulk-clear-btn"
                onClick={() => setSelectedStudentIds([])}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className={`panel ${onlyBatchId ? 'batch-students-panel' : ''}`}>
        {sortedStudents.length === 0 ? (
          <p className="empty-state">No students match your filters.</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-scroll">
              <table
                className="admin-table-el"
                style={{ minWidth: `${tableMinWidth}px` }}
              >
                <thead className="admin-table-head">
                  <tr>
                    <th
                      className="selection-col-head pinned-col selection-col-cell"
                      style={{ width: `${selectionColumnWidth}px`, left: '0px' }}
                    >
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="row-select-checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                        title="Select all visible students"
                      />
                    </th>
                    {activeColumns.map((column) => (
                      <th
                        key={column.key}
                        style={{
                          width: `${columnWidths[column.key]}px`,
                          left:
                            column.key in pinnedLeftMap
                              ? `${pinnedLeftMap[column.key]}px`
                              : undefined,
                        }}
                        className={
                          orderedPinnedKeys.includes(column.key)
                            ? 'pinned-col'
                            : undefined
                        }
                      >
                        <div className="th-wrap">
                          <span className="th-label">
                            {column.key === 'name' ? (
                              <>
                                <Users size={13} /> {column.label}
                              </>
                            ) : (
                              column.label
                            )}
                          </span>
                          <button
                            type="button"
                            className="sort-icon-btn"
                            onClick={() => toggleSort(column.key)}
                            title="Sort column"
                          >
                            {getSortIcon(column.key)}
                          </button>
                        </div>
                        {column.key !== activeColumns[activeColumns.length - 1]?.key ? (
                          <span
                            className="col-resize-handle"
                            onMouseDown={(event) =>
                              startResize(column.key, event)
                            }
                            title="Drag to resize"
                          />
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student) => (
                    <tr
                      className={`admin-table-row ${
                        selectedStudentIds.includes(student.id) ? 'is-selected' : ''
                      }`}
                      key={student.id}
                    >
                      <td
                        className="selection-col-cell pinned-col"
                        style={{ width: `${selectionColumnWidth}px`, left: '0px' }}
                      >
                        <input
                          type="checkbox"
                          className="row-select-checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={(event) =>
                            toggleStudentSelection(student.id, event.target.checked)
                          }
                          title={`Select ${student.name}`}
                        />
                      </td>
                      {activeColumns.map((column) => (
                        <td
                          key={`${student.id}-${column.key}`}
                          style={{
                            width: `${columnWidths[column.key]}px`,
                            left:
                              column.key in pinnedLeftMap
                                ? `${pinnedLeftMap[column.key]}px`
                                : undefined,
                          }}
                          className={
                            orderedPinnedKeys.includes(column.key)
                              ? 'pinned-col'
                              : undefined
                          }
                        >
                          {renderCell(student, column.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      {isBulkOpen ? (
        <>
          <div className="drawer-overlay" onClick={() => !bulkSaving && setIsBulkOpen(false)} />
          <div className="bulk-update-modal">
            <div className="bulk-update-head">
              <h3>Bulk Update Students</h3>
              <button
                type="button"
                className="drawer-close"
                onClick={() => !bulkSaving && setIsBulkOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form className="bulk-update-form" onSubmit={saveBulkUpdate}>
              <p className="muted-dark">
                Apply one field update to {selectedStudentIds.length} selected students.
              </p>
              <label>
                Field
                <select
                  value={bulkField}
                  onChange={(event) => handleBulkFieldChange(event.target.value as BulkFieldKey)}
                >
                  {bulkFieldConfigs.map((config) => (
                    <option key={config.key} value={config.key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New value
                {currentBulkConfig.inputType === 'select' ? (
                  <select
                    value={bulkValue}
                    onChange={(event) => setBulkValue(event.target.value)}
                  >
                    {currentBulkConfig.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={currentBulkConfig.inputType}
                    value={bulkValue}
                    onChange={(event) => setBulkValue(event.target.value)}
                    required
                  />
                )}
              </label>
              {bulkError ? <p className="error">{bulkError}</p> : null}
              <div className="bulk-update-actions">
                <button
                  type="button"
                  className="bulk-clear-btn"
                  onClick={() => setIsBulkOpen(false)}
                  disabled={bulkSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="bulk-update-btn" disabled={bulkSaving}>
                  {bulkSaving ? 'Saving...' : 'Save Update'}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}
      {isCreateOpen ? (
        <div
          className="drawer-overlay"
          onClick={() => {
            if (!formSaving) setIsCreateOpen(false)
          }}
        />
      ) : null}
      <aside className={`right-drawer ${isCreateOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Add New Student</h3>
          <button
            type="button"
            className="drawer-close"
            onClick={() => !formSaving && setIsCreateOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        <form className="drawer-form" onSubmit={createStudent}>
          <label>
            Student
            <input
              type="text"
              value={formData.student_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, student_name: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Trainer
            <select
              value={formData.trainer_id}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, trainer_id: e.target.value }))
              }
              required
            >
              <option value="">Select trainer</option>
              {allTrainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.trainer_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Batch
            <select
              value={formData.batch_id}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, batch_id: e.target.value }))
              }
              disabled={Boolean(onlyBatchId)}
              required
            >
              {!onlyBatchId ? <option value="">Select batch</option> : null}
              {onlyBatchId && fixedBatch ? (
                <option value={fixedBatch.id}>{fixedBatch.batch_code}</option>
              ) : (
                batchesForTrainer.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_code}
                  </option>
                ))
              )}
            </select>
          </label>
          <label>
            Phone
            <input
              type="text"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Payment
            <select
              value={formData.payment_status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, payment_status: e.target.value }))
              }
              required
            >
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label>
            Email
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Course Fee
            <input
              type="number"
              min="0"
              value={formData.course_fee}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, course_fee: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Amount Paid
            <input
              type="number"
              min="0"
              value={formData.amount_paid}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, amount_paid: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Enrollment Date
            <div className="date-input-wrap">
              <CalendarDays size={14} />
              <input
                type="date"
                value={formData.enrollment_date}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    enrollment_date: e.target.value,
                  }))
                }
                required
              />
            </div>
          </label>
          <label>
            Gender
            <select
              value={formData.gender}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, gender: e.target.value }))
              }
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          {formError ? <p className="error">{formError}</p> : null}
          <button type="submit" className="drawer-submit" disabled={formSaving}>
            {formSaving ? 'Creating...' : 'Create Student'}
          </button>
        </form>
      </aside>
    </>
  )
}

