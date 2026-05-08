import { useEffect, useMemo, useRef, useState } from 'react'
import { SpxLoader } from '../components/SpxLoader'
import type { FormEvent } from 'react'
import { Calendar, ChevronDown, ChevronUp, Clock, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getZoomHosts, scheduleClass } from '../lib/zoomApi'

type AdminCreateClassPageProps = {
  batchId: string
  onBack: () => void
  onCreated?: () => void
}

type BatchLite = {
  id: string
  batch_code: string
  trainer_id: string | null
}

const trainerTopicOptions = [
  'Introduction & Training Roadmap',
  'Pre-Project Activities',
  'SDLC - Initiation Phase',
  'SDLC - Project Planning',
  'Requirements Gathering (Elicitation Techniques)',
  'Requirement Documentation (RTM, BRD, FRD)',
  'Project & Requirements Revision',
  'Requirement Analysis (GAP, SMART, MoSCoW)',
  'Stakeholder Management & RACI Matrix',
  'Applications Usage Assignment',
  'Resume Project Conversion',
  'Resume Review & Corrections',
  'Resume Finalization & Upload',
  'Agile & Scrum Framework',
  'Jira & User Stories',
  'Agile, Scrum & Jira Revision',
  'Agile & Jira Practical Preparation',
  'Naukri & Resume Analysis',
  'Types of Requirements',
  'SDLC Phases 3 & 4',
  'SDLC Phase 5',
  'UML Diagrams',
  'Change Request Handling',
  'Interview Preparation',
  'DBMS Fundamentals',
  'SQL Basics',
  'SQL Intermediate',
  'SQL Advanced & Revision',
] as const

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toTimeInputValue(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function AdminCreateClassPage({
  batchId,
  onBack,
  onCreated,
}: AdminCreateClassPageProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [batch, setBatch] = useState<BatchLite | null>(null)
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null)
  const [topicOpen, setTopicOpen] = useState(false)
  const topicBoxRef = useRef<HTMLDivElement | null>(null)
  const [zoomHosts, setZoomHosts] = useState<
    Array<{ id: string; display_name: string; first_name: string }>
  >([])

  const now = new Date()
  now.setMinutes(now.getMinutes() + 30)
  const defaultEnd = new Date(now.getTime() + 60 * 60 * 1000)

  const [form, setForm] = useState({
    classTitle: '',
    isOtherTopic: false,
    customTopicName: '',
    date: toDateInputValue(now),
    startTime: toTimeInputValue(now),
    hostUserId: '',
    addAssignment: false,
    assignmentTitle: '',
    assignmentDescription: '',
    assignmentDueAt: `${toDateInputValue(defaultEnd)}T${toTimeInputValue(defaultEnd)}`,
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const [
        { data: batchRow, error: batchError },
        hostResult,
      ] = await Promise.all([
        supabase
          .from('batches')
          .select('id,batch_code,trainer_id')
          .eq('id', batchId)
          .maybeSingle(),
        getZoomHosts(),
      ])

      if (batchError || !batchRow) {
        setError(batchError?.message ?? 'Failed to load class form.')
        setLoading(false)
        return
      }

      const hosts = (hostResult.hosts ?? []).map((host) => ({
        id: host.id,
        display_name: host.display_name,
        first_name: host.first_name,
      }))

      setBatch(batchRow as BatchLite)
      setZoomHosts(hosts)
      if (hosts[0]) {
        setForm((prev) => ({ ...prev, hostUserId: prev.hostUserId || hosts[0].id }))
      }
      setLoading(false)
    }

    void load()
  }, [batchId])

  const resolvedTopic = useMemo(
    () => (form.isOtherTopic ? form.customTopicName.trim() : form.classTitle.trim()),
    [form.classTitle, form.customTopicName, form.isOtherTopic],
  )
  const filteredTopics = useMemo(() => {
    const query = form.classTitle.trim().toLowerCase()
    if (!query) return [...trainerTopicOptions]
    return trainerTopicOptions.filter((topic) =>
      topic.toLowerCase().includes(query),
    )
  }, [form.classTitle])

  const durationMinutes = useMemo(() => {
    return 60
  }, [])

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!topicBoxRef.current) return
      if (!topicBoxRef.current.contains(event.target as Node)) {
        setTopicOpen(false)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!batch) return
    if (!resolvedTopic || !form.date || !form.startTime || !form.hostUserId) {
      setError('Class title, date, start time and host are required.')
      return
    }

    const startIso = new Date(`${form.date}T${form.startTime}:00`).toISOString()
    const endIso = new Date(
      new Date(startIso).getTime() + durationMinutes * 60 * 1000,
    ).toISOString()

    if (form.addAssignment) {
      if (!form.assignmentTitle.trim() || !form.assignmentDueAt) {
        setError('Assignment title and due date/time are required.')
        return
      }
      const dueIso = new Date(form.assignmentDueAt).toISOString()
      if (new Date(dueIso).getTime() < new Date(endIso).getTime()) {
        setError('Assignment due date/time cannot be before class end time.')
        return
      }
    }

    try {
      setSaving(true)
      setError('')
      const response = await scheduleClass({
        batchId: batch.id,
        trainerId: batch.trainer_id ?? undefined,
        hostUserId: form.hostUserId,
        topic: resolvedTopic,
        startTime: startIso,
        duration: durationMinutes,
      })

      if (form.addAssignment) {
        const dueIso = new Date(form.assignmentDueAt).toISOString()
        let uploadedFileUrl: string | null = null
        if (assignmentFile) {
          const safeName = assignmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const filePath = `batch-${batch.id}/${response.classSession.id}/${Date.now()}-${safeName}`
          const { error: uploadError } = await supabase.storage
            .from('assignments')
            .upload(filePath, assignmentFile, { upsert: false })
          if (uploadError) throw uploadError
          const { data: publicData } = supabase.storage
            .from('assignments')
            .getPublicUrl(filePath)
          uploadedFileUrl = publicData.publicUrl ?? null
        }

        const { error: assignmentError } = await supabase.from('assignments').insert({
          batch_id: batch.id,
          class_session_id: response.classSession.id,
          title: form.assignmentTitle.trim(),
          description: form.assignmentDescription.trim() || null,
          attachment_url: uploadedFileUrl,
          due_at: dueIso,
          max_marks: 10,
          submission_type: 'both',
          assign_to_all: true,
          target_student_ids: null,
        })
        if (assignmentError) throw assignmentError
      }

      onCreated?.()
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Unable to create class.'
      if (message.includes('public.assignments')) {
        setError(
          'Assignments table is missing in Supabase. Run assignments_schema.sql once, then try again.',
        )
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SpxLoader label="Loading class scheduler…" />
  }

  if (error && !batch) {
    return (
      <section className="panel">
        <button type="button" className="batch-detail-back" onClick={onBack}>
          ← Back
        </button>
        <p className="error">{error}</p>
      </section>
    )
  }

  return (
    <section className="create-class-page">
      <div className="create-class-topbar">
        <div>
          <p className="create-class-breadcrumb">Dashboard &gt; Classes &gt; Create New Class</p>
          <h1>Create New Class</h1>
          <p className="muted-dark">Schedule a new class for your batch</p>
        </div>
        <div className="create-class-top-actions">
          <button type="button" className="batch-schedule-cancel" onClick={onBack}>
            Cancel
          </button>
          <button type="submit" form="create-class-form" className="batch-schedule-submit">
            Create Class
          </button>
        </div>
      </div>

      <form id="create-class-form" className="create-class-card" onSubmit={handleSubmit}>
        <h3 className="create-class-section-title">Class Details</h3>

        <div className="create-class-field create-class-topic-field">
          <span>Class Title *</span>
          <div ref={topicBoxRef} className="create-class-topic-combobox">
            <div className="create-class-topic-input-wrap">
              <input
                type="text"
                value={form.classTitle}
                onFocus={() => setTopicOpen(true)}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    classTitle: event.target.value,
                    isOtherTopic: false,
                  }))
                  setTopicOpen(true)
                }}
                placeholder="Search or type class topic"
                required
              />
              <button
                type="button"
                className="create-class-topic-chevron"
                onClick={() => setTopicOpen((open) => !open)}
                aria-label="Toggle topics list"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            {topicOpen ? (
              <div className="create-class-topic-dropdown">
                {filteredTopics.length ? (
                  <ul>
                    {filteredTopics.map((topic) => (
                      <li key={topic}>
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            setForm((prev) => ({ ...prev, classTitle: topic }))
                            setTopicOpen(false)
                          }}
                        >
                          {topic}
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          setForm((prev) => ({
                            ...prev,
                            classTitle: 'Others',
                            isOtherTopic: true,
                          }))
                          setTopicOpen(false)
                        }}
                      >
                        Others
                      </button>
                    </li>
                  </ul>
                ) : (
                  <p>No matching topics. You can type a custom title.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
        {form.isOtherTopic ? (
          <label className="create-class-field">
            <span>Custom Topic Name *</span>
            <input
              type="text"
              value={form.customTopicName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, customTopicName: event.target.value }))
              }
              placeholder="Enter custom topic name"
              required
            />
          </label>
        ) : null}

        <label className="create-class-field">
          <span>Trainer *</span>
          <select
            value={form.hostUserId}
            onChange={(event) => setForm((prev) => ({ ...prev, hostUserId: event.target.value }))}
            required
          >
            {zoomHosts.map((host) => (
              <option key={host.id} value={host.id}>
                {(host.first_name || '').trim() || host.display_name}
              </option>
            ))}
          </select>
        </label>

        <label className="create-class-field create-class-field-icon">
          <span>Date *</span>
          <div className="create-class-input-icon-wrap">
            <Calendar size={14} />
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
          </div>
        </label>

        <label className="create-class-field create-class-field-icon">
          <span>Start Time *</span>
          <div className="create-class-input-icon-wrap">
            <Clock size={14} />
            <input
              type="time"
              value={form.startTime}
              onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
              required
            />
          </div>
        </label>


        <div className="create-class-divider" />

        <div className="create-class-assignment-toggle">
          <button
            type="button"
            className="create-class-switch"
            role="switch"
            aria-checked={form.addAssignment}
            aria-label="Add Assignment for this Class"
            onClick={() =>
              setForm((prev) => ({ ...prev, addAssignment: !prev.addAssignment }))
            }
          >
            <span className="create-class-switch-knob" />
          </button>
          <div>
            <strong>Add Assignment for this Class</strong>
            <p>Attach an assignment that students need to complete after this class.</p>
          </div>
          <button
            type="button"
            className="create-class-assignment-collapse"
            onClick={() =>
              setForm((prev) => ({ ...prev, addAssignment: !prev.addAssignment }))
            }
            aria-label={form.addAssignment ? 'Collapse assignment' : 'Expand assignment'}
          >
            {form.addAssignment ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {form.addAssignment ? (
          <div className="create-class-assignment-card">
            <h4>Assignment Details</h4>
            <label className="create-class-field">
              <span>Assignment Title *</span>
              <input
                value={form.assignmentTitle}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assignmentTitle: event.target.value }))
                }
                required
              />
            </label>
            <label className="create-class-field">
              <span>Description</span>
              <input
                value={form.assignmentDescription}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assignmentDescription: event.target.value }))
                }
              />
            </label>
            <label className="create-class-field create-class-field-span2">
              <span>Upload File (Optional)</span>
              <div className="create-class-upload-box">
                <Upload size={18} />
                <p>Choose file from your computer</p>
                <small>PDF, DOC, DOCX, PPT, ZIP</small>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.txt"
                  onChange={(event) => setAssignmentFile(event.target.files?.[0] ?? null)}
                />
              </div>
            </label>
            <label className="create-class-field create-class-field-icon create-class-field-span2">
              <span>Due Date & Time *</span>
              <div className="create-class-input-icon-wrap">
                <Calendar size={14} />
                <input
                  type="datetime-local"
                  value={form.assignmentDueAt}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, assignmentDueAt: event.target.value }))
                  }
                  required
                />
              </div>
            </label>
          </div>
        ) : null}

        {error ? <p className="error create-class-error">{error}</p> : null}

        <div className="create-class-bottom-actions">
          <button type="button" className="batch-schedule-cancel" onClick={onBack} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="batch-schedule-submit" disabled={saving}>
            {saving ? 'Saving...' : 'Create Class'}
          </button>
        </div>
      </form>
    </section>
  )
}
