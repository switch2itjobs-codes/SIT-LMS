import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Search,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type HomePageProps = {
  session: Session
}

type DashboardTab = 'classes' | 'announcements' | 'my_batch'

type ClassSessionItem = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  join_url: string | null
  recording_url: string | null
  batch_id: string
  batch_code: string
  trainer_name: string
}

type AnnouncementItem = {
  id: string
  title: string
  body: string
  published_at: string
  is_important: boolean
}

type BatchItem = {
  id: string
  batch_code: string
  status: string
  batch_type: string
  trainer_name: string
  start_date: string | null
  end_date: string | null
}

type SessionStatus = 'upcoming' | 'live' | 'completed'

export function HomePage({ session }: HomePageProps) {
  const userRole = (session.user.app_metadata.role as string | undefined) ?? 'student'
  const displayName =
    (session.user.user_metadata.full_name as string | undefined) ??
    session.user.email
  const firstName = displayName?.split(' ')[0] ?? 'Student'
  const dateText = new Date().toLocaleDateString('en-GB')
  const [activeTab, setActiveTab] = useState<DashboardTab>('classes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [meetingStatus, setMeetingStatus] = useState<
    'all' | SessionStatus
  >('all')
  const [meetingDate, setMeetingDate] = useState('')
  const [allClasses, setAllClasses] = useState<ClassSessionItem[]>([])
  const [todayClasses, setTodayClasses] = useState<ClassSessionItem[]>([])
  const [upcomingClasses, setUpcomingClasses] = useState<ClassSessionItem[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [myBatches, setMyBatches] = useState<BatchItem[]>([])

  const onSignOut = async () => {
    await supabase.auth.signOut()
  }

  useEffect(() => {
    const loadDashboardData = async () => {
      if (userRole !== 'student') {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', session.user.id)
        .single()

      if (studentError || !student) {
        setError('Student profile not linked yet. Please contact admin.')
        setLoading(false)
        return
      }

      const { data: studentBatchRows, error: studentBatchError } = await supabase
        .from('student_batches')
        .select('batch_id')
        .eq('student_id', student.id)
        .eq('is_active', true)

      if (studentBatchError) {
        setError(studentBatchError.message)
        setLoading(false)
        return
      }

      const batchIds = (studentBatchRows ?? []).map((row) => row.batch_id)

      if (!batchIds.length) {
        setAllClasses([])
        setTodayClasses([])
        setUpcomingClasses([])
        setAnnouncements([])
        setMyBatches([])
        setLoading(false)
        return
      }

      const [{ data: batchRows, error: batchError }, { data: classRows, error: classError }, { data: announcementRows, error: announcementError }] =
        await Promise.all([
          supabase
            .from('batches')
            .select('id,batch_code,status,batch_type,trainer_id,start_date,end_date')
            .in('id', batchIds),
          supabase
            .from('class_sessions')
            .select(
              'id,title,description,starts_at,ends_at,join_url,recording_url,batch_id,trainer_id',
            )
            .in('batch_id', batchIds)
            .order('starts_at', { ascending: true }),
          supabase
            .from('announcements')
            .select('id,title,body,batch_id,published_at,is_important,expires_at')
            .order('published_at', { ascending: false }),
        ])

      if (batchError || classError || announcementError) {
        setError(batchError?.message ?? classError?.message ?? announcementError?.message ?? 'Failed to load dashboard data.')
        setLoading(false)
        return
      }

      const trainerIds = Array.from(
        new Set(
          (batchRows ?? [])
            .map((batch) => batch.trainer_id)
            .filter((trainerId): trainerId is string => Boolean(trainerId)),
        ),
      )

      const { data: trainerRows } = trainerIds.length
        ? await supabase
            .from('trainers')
            .select('id,trainer_name')
            .in('id', trainerIds)
        : { data: [] as Array<{ id: string; trainer_name: string }> }

      const trainerNameById = new Map((trainerRows ?? []).map((row) => [row.id, row.trainer_name]))
      const batchById = new Map((batchRows ?? []).map((row) => [row.id, row]))

      const classItems: ClassSessionItem[] = (classRows ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        starts_at: item.starts_at,
        ends_at: item.ends_at,
        join_url: item.join_url,
        recording_url: item.recording_url,
        batch_id: item.batch_id,
        batch_code: batchById.get(item.batch_id)?.batch_code ?? 'Batch',
        trainer_name:
          trainerNameById.get(item.trainer_id ?? '') ??
          trainerNameById.get(batchById.get(item.batch_id)?.trainer_id ?? '') ??
          'Trainer',
      }))

      const now = new Date()
      setAllClasses(classItems)
      const dayStart = new Date(now)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      setTodayClasses(
        classItems.filter((item) => {
          const when = new Date(item.starts_at)
          return when >= dayStart && when < dayEnd
        }),
      )

      setUpcomingClasses(
        classItems.filter((item) => {
          const when = new Date(item.starts_at)
          return when >= dayEnd
        }),
      )

      const batchIdSet = new Set(batchIds)
      const nowIso = now.toISOString()
      setAnnouncements(
        (announcementRows ?? [])
          .filter((item) => !item.batch_id || batchIdSet.has(item.batch_id))
          .filter((item) => !item.expires_at || item.expires_at > nowIso)
          .map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            published_at: item.published_at,
            is_important: item.is_important,
          })),
      )

      setMyBatches(
        (batchRows ?? []).map((batch) => ({
          id: batch.id,
          batch_code: batch.batch_code,
          status: batch.status,
          batch_type: batch.batch_type,
          trainer_name: trainerNameById.get(batch.trainer_id ?? '') ?? 'Trainer',
          start_date: batch.start_date,
          end_date: batch.end_date,
        })),
      )

      setLoading(false)
    }

    void loadDashboardData()
  }, [session.user.id, userRole])

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) =>
      `${item.title} ${item.body}`.toLowerCase().includes(query.toLowerCase()),
    )
  }, [announcements, query])

  const filteredBatches = useMemo(() => {
    return myBatches
  }, [myBatches])

  const getSessionStatus = (item: ClassSessionItem): SessionStatus => {
    const now = Date.now()
    const startsAt = new Date(item.starts_at).getTime()
    const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null
    if (startsAt > now) return 'upcoming'
    if (endsAt && now > endsAt) return 'completed'
    return 'live'
  }

  const sessionStatusMeta = (status: SessionStatus) => {
    if (status === 'upcoming') {
      return { label: 'Upcoming', className: 'student-status-upcoming' }
    }
    if (status === 'live') {
      return { label: 'Live', className: 'student-status-live' }
    }
    return { label: 'Completed', className: 'student-status-completed' }
  }

  const formatLabel = (value: string) =>
    value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')

  const filteredClasses = useMemo(() => {
    return allClasses.filter((item) => {
      const status = getSessionStatus(item)
      const statusOk = meetingStatus === 'all' || status === meetingStatus
      if (!statusOk) return false

      if (!meetingDate) return true
      const classDate = new Date(item.starts_at).toISOString().slice(0, 10)
      return classDate === meetingDate
    })
  }, [allClasses, meetingDate, meetingStatus])

  const classBuckets = useMemo(() => {
    const live: ClassSessionItem[] = []
    const upcoming: ClassSessionItem[] = []
    const past: ClassSessionItem[] = []

    for (const item of filteredClasses) {
      const status = getSessionStatus(item)
      if (status === 'live') live.push(item)
      else if (status === 'upcoming') upcoming.push(item)
      else past.push(item)
    }

    live.sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    upcoming.sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    past.sort(
      (a, b) =>
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    )

    return { live, upcoming, past }
  }, [filteredClasses])

  if (userRole !== 'student') {
    return (
      <main className="auth-layout">
        <section className="card home-card">
          <h1>Dashboard pending</h1>
          <p className="muted">
            This page is only for students. Trainer and admin dashboards will be
            created separately.
          </p>
          <button onClick={onSignOut}>Sign Out</button>
        </section>
      </main>
    )
  }

  if (loading) {
    return <div className="center-screen dashboard-loading">Loading dashboard...</div>
  }

  if (error) {
    return (
      <main className="auth-layout">
        <section className="card home-card">
          <h1>Unable to load dashboard</h1>
          <p className="error">{error}</p>
          <button onClick={onSignOut}>Sign Out</button>
        </section>
      </main>
    )
  }

  const showClassFilters = activeTab === 'classes'

  return (
    <main className="student-layout">
      <aside className="student-sidebar">
        <div>
          <div className="brand">
            <img src="/sit-logo.png" alt="SIT logo" className="brand-logo" />
            <span>StdPortal</span>
          </div>
          <nav className="sidebar-nav">
            <button className="sidebar-item active">
              <LayoutDashboard size={16} />
              Dashboard
            </button>
            <button className="sidebar-item">
              <CalendarDays size={16} />
              All Classes
            </button>
          </nav>
        </div>

        <button className="sidebar-user" onClick={onSignOut}>
          <div className="avatar">{firstName[0]?.toUpperCase()}</div>
          <div className="user-meta">
            <p>{displayName}</p>
            <span>{session.user.email}</span>
          </div>
          <LogOut size={14} />
        </button>
      </aside>

      <section className="student-content">
        <header className="welcome-card">
          <p className="date-tag">{dateText}</p>
          <h1>Welcome back, {firstName}</h1>
          <p className="muted-dark">
            Your classes, links, recordings, and announcements - all in one
            place.
          </p>
        </header>

        <section className="stats-grid">
          <article className="metric-card">
            <p>Today&apos;s Classes</p>
            <h2>{todayClasses.length}</h2>
          </article>
          <article className="metric-card">
            <p>Upcoming Classes</p>
            <h2>{upcomingClasses.length}</h2>
          </article>
          <article className="metric-card">
            <p>Announcements</p>
            <h2>{announcements.length}</h2>
          </article>
        </section>

        <div className="tabs-row">
          <button
            className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
            onClick={() => setActiveTab('classes')}
          >
            <CalendarDays size={14} /> Classes
          </button>
          <button
            className={`tab ${activeTab === 'announcements' ? 'active' : ''}`}
            onClick={() => setActiveTab('announcements')}
          >
            <Megaphone size={14} /> Announcements
          </button>
          <button
            className={`tab ${activeTab === 'my_batch' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_batch')}
          >
            <Users size={14} /> My Batch
          </button>
        </div>

        <section className="panel">
          {activeTab === 'announcements' ? (
            <div className="panel-top panel-top-search-only">
              <div className="panel-actions">
                <div className="search-box">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {showClassFilters ? (
            <div className="filters-row student-classes-filters-row">
              <label className="filter-select">
                <span>Meeting Status</span>
                <select
                  value={meetingStatus}
                  onChange={(event) =>
                    setMeetingStatus(event.target.value as 'all' | SessionStatus)
                  }
                >
                  <option value="all">All</option>
                  <option value="live">Live</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                </select>
                <ChevronDown size={14} />
              </label>

              <label className="filter-select">
                <span>Date</span>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(event) => setMeetingDate(event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {activeTab === 'classes' ? (
            filteredClasses.length ? (
              <div className="live-classes-cards">
                {classBuckets.live.length ? (
                  <article className="live-class-card live-class-card-live">
                    <header className="live-class-card-head">
                      <span className="live-class-card-title">Live</span>
                    </header>
                    <div className="live-class-card-body">
                      {classBuckets.live.map((item) => (
                        <article className="class-row class-row-in-card" key={item.id}>
                          <div className="class-col">
                            <p className="class-title">{item.title}</p>
                            <span className="class-sub">
                              {new Date(item.starts_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="class-col class-link">
                            <span className={`tag-pill ${sessionStatusMeta('live').className}`}>
                              Live
                            </span>
                          </div>
                          <div className="class-col class-actions">
                            {item.join_url ? (
                              <a
                                className="join-btn"
                                href={item.join_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Join
                              </a>
                            ) : (
                              <span className="no-link">Link not available</span>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>
                ) : null}

                <article className="live-class-card">
                  <header className="live-class-card-head live-class-card-head-blue">
                    <span className="live-class-card-title">Upcoming</span>
                  </header>
                  <div className="live-class-card-body">
                    {classBuckets.upcoming.length ? (
                      classBuckets.upcoming.map((item) => (
                        <article className="class-row class-row-in-card" key={item.id}>
                          <div className="class-col">
                            <p className="class-title">{item.title}</p>
                            <span className="class-sub">
                              {new Date(item.starts_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="class-col class-link">
                            <span className={`tag-pill ${sessionStatusMeta('upcoming').className}`}>
                              Upcoming
                            </span>
                          </div>
                          <div className="class-col class-actions">
                            {item.join_url ? (
                              <a
                                className="join-btn"
                                href={item.join_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Join
                              </a>
                            ) : (
                              <span className="no-link">Link not available</span>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="empty-state">No upcoming classes.</p>
                    )}
                  </div>
                </article>

                <article className="live-class-card">
                  <header className="live-class-card-head live-class-card-head-blue">
                    <span className="live-class-card-title">Past classes &amp; recordings</span>
                  </header>
                  <div className="live-class-card-body">
                    {classBuckets.past.length ? (
                      classBuckets.past.map((item) => (
                        <article className="class-row class-row-in-card" key={item.id}>
                          <div className="class-col">
                            <p className="class-title">{item.title}</p>
                            <span className="class-sub">
                              {new Date(item.starts_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="class-col class-link">
                            <span className={`tag-pill ${sessionStatusMeta('completed').className}`}>
                              Completed
                            </span>
                          </div>
                          <div className="class-col class-actions">
                            {item.recording_url ? (
                              <a
                                className="join-btn"
                                href={item.recording_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View Recording
                              </a>
                            ) : (
                              <button type="button" className="join-btn" disabled>
                                View Recording
                              </button>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="empty-state">No past classes.</p>
                    )}
                  </div>
                </article>
              </div>
            ) : (
              <p className="empty-state">No classes found for selected filters.</p>
            )
          ) : null}

          {activeTab === 'announcements' ? (
            filteredAnnouncements.length ? (
              <div className="student-announcement-list">
                {filteredAnnouncements.map((item) => (
                  <article className="announcement-row announcement-row-in-list" key={item.id}>
                    <div>
                      <p className="class-title">
                        {item.title}
                        {item.is_important ? (
                          <span className="important-tag">Important</span>
                        ) : null}
                      </p>
                      <p className="muted-dark">{item.body}</p>
                    </div>
                    <span className="class-sub">
                      {new Date(item.published_at).toLocaleString()}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No announcements available.</p>
            )
          ) : null}

          {activeTab === 'my_batch' ? (
            filteredBatches.length ? (
              <div className="student-batch-list">
                {filteredBatches.map((item) => (
                  <article className="student-batch-card" key={item.id}>
                    <div className="student-batch-card-head">
                      <p className="student-batch-code">{item.batch_code}</p>
                      <div className="student-batch-meta">
                        <span className="student-batch-pill student-batch-pill-trainer">
                          {item.trainer_name}
                        </span>
                        <span className="student-batch-pill student-batch-pill-type">
                          {formatLabel(item.batch_type)}
                        </span>
                        <span
                          className={`student-batch-pill student-batch-pill-status student-batch-status-${item.status.toLowerCase()}`}
                        >
                          {formatLabel(item.status)}
                        </span>
                      </div>
                    </div>
                    <div className="student-batch-date-range">
                      <span>{item.start_date ?? 'Start date TBD'}</span>
                      <span className="student-batch-date-sep">to</span>
                      <span>{item.end_date ?? 'End date TBD'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No batch details found.</p>
            )
          ) : null}
        </section>
      </section>
    </main>
  )
}
