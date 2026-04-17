import React, { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Users,
  CalendarDays,
  Megaphone,
  Briefcase,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AdminStudentsPage } from './AdminStudentsPage'
import { AdminBatchesPage } from './AdminBatchesPage'
import {
  AdminBatchDetailPage,
  type BatchDetailTab,
} from './AdminBatchDetailPage'

type AdminHomePageProps = {
  session: Session
}

type MetricCard = {
  label: string
  value: number | string
  icon: React.ReactNode
}

export function AdminHomePage({ session }: AdminHomePageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const displayName =
    (session.user.user_metadata.full_name as string | undefined) ??
    session.user.email
  const firstName = displayName?.split(' ')[0] ?? 'Admin'
  const dateText = new Date().toLocaleDateString('en-GB')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState<MetricCard[]>([])

  const onSignOut = async () => {
    await supabase.auth.signOut()
  }

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true)
      setError('')

      const { data, error: queryError } = await supabase.rpc('admin_overview_metrics')

      if (queryError) {
        // If the helper function does not exist yet, fall back to direct counts.
        const [{ count: studentCount }, { count: batchCount }, { count: classCount }] =
          await Promise.all([
            supabase.from('students').select('*', { count: 'exact', head: true }),
            supabase.from('batches').select('*', { count: 'exact', head: true }),
            supabase.from('class_sessions').select('*', { count: 'exact', head: true }),
          ])

        setMetrics([
          {
            label: 'Active Students',
            value: studentCount ?? 0,
            icon: <Users size={18} />,
          },
          {
            label: 'Active Batches',
            value: batchCount ?? 0,
            icon: <CalendarDays size={18} />,
          },
          {
            label: 'Today / Upcoming Classes',
            value: classCount ?? 0,
            icon: <GraduationCap size={18} />,
          },
        ])
        setLoading(false)
        return
      }

      setMetrics([
        {
          label: 'Active Students',
          value: data.active_students ?? 0,
          icon: <Users size={18} />,
        },
        {
          label: 'Active Batches',
          value: data.active_batches ?? 0,
          icon: <CalendarDays size={18} />,
        },
        {
          label: 'Today / Upcoming Classes',
          value: data.upcoming_classes ?? 0,
          icon: <GraduationCap size={18} />,
        },
        {
          label: 'Total Placements',
          value: data.total_placements ?? 0,
          icon: <Briefcase size={18} />,
        },
      ])
      setLoading(false)
    }

    void loadMetrics()
  }, [])

  useEffect(() => {
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      navigate('/admin/overview', { replace: true })
    }
  }, [location.pathname, navigate])

  const adminPath =
    location.pathname === '/admin' ? '/admin/overview' : location.pathname
  const match = adminPath.match(
    /^\/admin\/batches\/([^/]+)(?:\/(overview|live-classes|students|schedule|announcements|assignments))?\/?$/,
  )
  const batchIdFromPath = match?.[1] ?? null
  const batchTabFromPath = (match?.[2] as BatchDetailTab | undefined) ?? 'overview'

  const section: 'overview' | 'students' | 'batches' | 'batch-detail' =
    batchIdFromPath
      ? 'batch-detail'
      : adminPath === '/admin/students'
        ? 'students'
        : adminPath === '/admin/batches'
          ? 'batches'
          : 'overview'

  if (loading) {
    return <div className="center-screen dashboard-loading">Loading admin overview...</div>
  }

  if (error) {
    return (
      <main className="auth-layout">
        <section className="card home-card">
          <h1>Admin dashboard error</h1>
          <p className="error">{error}</p>
          <button onClick={onSignOut}>Sign Out</button>
        </section>
      </main>
    )
  }

  return (
    <main className="student-layout">
      <aside className="student-sidebar">
        <div>
          <div className="brand">
            <img src="/sit-logo.png" alt="SIT logo" className="brand-logo" />
            <span>Admin Panel</span>
          </div>
          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${
                section === 'overview' ? 'active' : ''
              }`}
              onClick={() => {
                navigate('/admin/overview')
              }}
            >
              <LayoutDashboard size={16} />
              Overview
            </button>
            <button
              className={`sidebar-item ${
                section === 'students' ? 'active' : ''
              }`}
              onClick={() => {
                navigate('/admin/students')
              }}
            >
              <Users size={16} />
              Students
            </button>
            <button
              className={`sidebar-item ${
                section === 'batches' || section === 'batch-detail'
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                navigate('/admin/batches')
              }}
            >
              <CalendarDays size={16} />
              Batches & Classes
            </button>
            <button className="sidebar-item" type="button">
              <Megaphone size={16} />
              Announcements
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
        {section === 'overview' ? (
          <>
            <header className="welcome-card">
              <p className="date-tag">{dateText}</p>
              <h1>Welcome, {firstName}</h1>
              <p className="muted-dark">
                High-level view of students, batches, classes, and placements.
              </p>
            </header>

            <section className="stats-grid">
              {metrics.map((metric) => (
                <article
                  className="metric-card metric-card-admin"
                  key={metric.label}
                >
                  <div className="metric-icon">{metric.icon}</div>
                  <div>
                    <p>{metric.label}</p>
                    <h2>{metric.value}</h2>
                  </div>
                </article>
              ))}
            </section>

            <section className="panel">
              <div className="panel-top">
                <div>
                  <h3>Quick links</h3>
                  <p className="muted-dark">
                    Use these sections to manage students, batches, classes, and
                    announcements.
                  </p>
                </div>
              </div>

              <div className="admin-quick-grid">
                <button
                  type="button"
                  className="admin-quick-card admin-quick-card-btn"
                  onClick={() => {
                    navigate('/admin/students')
                  }}
                >
                  <h4>Students</h4>
                  <p className="muted-dark">
                    View all students, stages, payments, and placement status.
                  </p>
                </button>
                <button
                  type="button"
                  className="admin-quick-card admin-quick-card-btn"
                  onClick={() => {
                    navigate('/admin/batches')
                  }}
                >
                  <h4>Batches & Classes</h4>
                  <p className="muted-dark">
                    Configure batches, assign trainers, and schedule class
                    sessions.
                  </p>
                </button>
                <div className="admin-quick-card">
                  <h4>Announcements</h4>
                  <p className="muted-dark">
                    Publish global or batch-specific announcements for all
                    students.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : section === 'students' ? (
          <AdminStudentsPage />
        ) : section === 'batches' ? (
          <AdminBatchesPage
            onOpenBatch={(id, code) => {
              navigate(`/admin/batches/${id}/overview`, {
                state: { batchCode: code },
              })
            }}
          />
        ) : section === 'batch-detail' && batchIdFromPath ? (
          <AdminBatchDetailPage
            batchId={batchIdFromPath}
            initialBatchCode={
              (location.state as { batchCode?: string } | null)?.batchCode
            }
            initialTab={batchTabFromPath}
            onTabChange={(tab) => navigate(`/admin/batches/${batchIdFromPath}/${tab}`)}
            onBack={() => {
              navigate('/admin/batches')
            }}
          />
        ) : null}
      </section>
    </main>
  )
}

