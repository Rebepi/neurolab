import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import LoginPage from './pages/LoginPage'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import WorkflowStepper from './components/WorkflowStepper'
import { Loader2, Cpu } from 'lucide-react'
import { api } from './services/api'

const CommandPalette = lazy(() => import('./components/CommandPalette'))
const DashboardModule = lazy(() => import('./modules/dashboard/DashboardModule'))
const ProjectsModule = lazy(() => import('./modules/projects/ProjectsModule'))
const FundamentalsModule = lazy(() => import('./modules/fundamentals/FundamentalsModule'))
const ArchitecturesModule = lazy(() => import('./modules/architectures/ArchitecturesModule'))
const DatasetsModule = lazy(() => import('./modules/datasets/DatasetsModule'))
const TrainingModule = lazy(() => import('./modules/training/TrainingModule'))
const EvaluationModule = lazy(() => import('./modules/evaluation/EvaluationModule'))
const ModelsModule = lazy(() => import('./modules/models/ModelsModule'))
const InferenceModule = lazy(() => import('./modules/inference/InferenceModule'))
const ReportsModule = lazy(() => import('./modules/reports/ReportsModule'))
const AdminModule = lazy(() => import('./modules/admin/AdminModule'))
const AuditModule = lazy(() => import('./modules/audit/AuditModule'))
const SettingsModule = lazy(() => import('./modules/settings/SettingsModule'))
const NeuralVisualizerModule = lazy(() => import('./modules/visualizer/NeuralVisualizerModule'))

function ModuleLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-module-enter">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-2 border-dashed animate-spin-slow opacity-50"
          style={{ borderColor: 'var(--nl-accent-light)' }}
        />
        <div
          className="absolute inset-1.5 rounded-full border border-t-transparent animate-spin-reverse"
          style={{ borderColor: 'var(--nl-accent)', borderTopColor: 'transparent' }}
        />
        <div className="w-10 h-10 rounded-2xl nl-cyber-panel animate-pop-in flex items-center justify-center nl-accent-glow">
          <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
        <span className="text-xs font-mono text-slate-400 tracking-wide">
          Inicializando módulo neuronal...
        </span>
      </div>
    </div>
  )
}

function AppWorkspace() {
  const { user, logout } = useAuth()
  const [activeModule, setActiveModule] = useState('dashboard')
  const [navSeq, setNavSeq] = useState(0)
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(null)
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    if (user && !currentProject) {
      api.getProjects().then(projs => {
        if (projs.length > 0) {
          setCurrentProject({ id: projs[0].id, name: projs[0].name })
        }
      }).catch(() => {})
    }
  }, [user, currentProject])

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  if (!user) {
    return <LoginPage />
  }

  function handleProjectSelect(project: any) {
    setCurrentProject({ id: project.id, name: project.name })
  }

  function handleNavigate(module: string) {
    setActiveModule(module)
    setNavSeq(s => s + 1)
  }

  return (
    <div className="relative flex h-screen overflow-hidden nl-grid-bg animate-studio-emerge">
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-40 left-[12%] w-[500px] h-[500px] rounded-full blur-[140px] opacity-[0.16] animate-aurora-1"
          style={{ backgroundColor: 'var(--nl-accent)' }}
        />
        <div
          className="absolute -bottom-44 right-[6%] w-[460px] h-[460px] rounded-full blur-[140px] opacity-[0.13] animate-aurora-2"
          style={{ backgroundColor: 'var(--nl-secondary)' }}
        />
      </div>

      {navSeq > 0 && (
        <div
          key={navSeq}
          className="pointer-events-none fixed top-0 left-0 right-0 h-[2px] z-[60] animate-nav-progress"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--nl-accent-light), var(--nl-secondary), transparent)'
          }}
        />
      )}

      <Sidebar
        activeModule={activeModule}
        onNavigate={handleNavigate}
        currentProject={currentProject}
        onSelectProject={handleProjectSelect}
      />

      <div className="relative z-10 flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          activeModule={activeModule}
          currentProject={currentProject}
          onSelectProject={handleProjectSelect}
          onOpenCommandPalette={() => setCmdOpen(true)}
          onLogout={logout}
          user={user}
        />

        <main
          className={`flex-1 px-6 py-5 ${
            activeModule === 'reports'
              ? 'overflow-y-auto lg:overflow-hidden print:overflow-visible'
              : activeModule === 'audit'
                ? 'overflow-y-auto md:overflow-hidden'
                : 'overflow-y-auto'
          }`}
        >
          <div
            className={`${
              activeModule === 'reports'
                ? 'min-h-full lg:h-full print:h-auto'
                : activeModule === 'audit'
                  ? 'min-h-full md:h-full'
                  : 'min-h-full'
            } flex flex-col`}
          >
            {['projects', 'datasets', 'architectures', 'training', 'evaluation', 'models', 'inference'].includes(activeModule) && (
              <WorkflowStepper
                activeModule={activeModule}
                onNavigate={handleNavigate}
                currentProject={currentProject}
              />
            )}

            <Suspense fallback={<ModuleLoader />}>
              <div
                key={activeModule}
                className={`animate-module-enter flex-1 flex flex-col ${
                  activeModule === 'reports'
                    ? 'lg:min-h-0'
                    : activeModule === 'audit'
                      ? 'md:min-h-0'
                      : ''
                }`}
              >
                {activeModule === 'dashboard' && (
                  <DashboardModule
                    onNavigate={handleNavigate}
                    currentProject={currentProject}
                    onSelectProject={handleProjectSelect}
                  />
                )}
                {activeModule === 'projects' && (
                  <ProjectsModule onProjectSelect={handleProjectSelect} currentProject={currentProject} onNavigate={handleNavigate} />
                )}
                {activeModule === 'fundamentals' && (
                  <FundamentalsModule />
                )}
                {activeModule === 'architectures' && (
                  <ArchitecturesModule currentProject={currentProject} onNavigate={handleNavigate} />
                )}
                {activeModule === 'datasets' && (
                  <DatasetsModule currentProject={currentProject} onNavigate={handleNavigate} />
                )}
                {activeModule === 'training' && (
                  <TrainingModule currentProject={currentProject} onNavigate={handleNavigate} />
                )}
                {activeModule === 'evaluation' && (
                  <EvaluationModule currentProject={currentProject} onNavigate={handleNavigate} />
                )}
                {activeModule === 'models' && (
                  <ModelsModule currentProject={currentProject} onNavigate={handleNavigate} />
                )}
                {activeModule === 'inference' && (
                  <InferenceModule
                    currentProject={currentProject}
                    onNavigate={handleNavigate}
                    onSelectProject={handleProjectSelect}
                  />
                )}
                {activeModule === 'reports' && (
                  <ReportsModule currentProject={currentProject} />
                )}
                {activeModule === 'admin' && (
                  <AdminModule currentUser={user} />
                )}
                {activeModule === 'audit' && (
                  <AuditModule />
                )}
                {activeModule === 'settings' && (
                  <SettingsModule currentUser={user} />
                )}
                {activeModule === 'visualizer' && (
                  <NeuralVisualizerModule currentProject={currentProject} onNavigate={handleNavigate} />
                )}
              </div>
            </Suspense>
          </div>
        </main>
      </div>

      <Suspense fallback={null}>
        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          onNavigate={handleNavigate}
        />
      </Suspense>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppWorkspace />
    </ThemeProvider>
  )
}
