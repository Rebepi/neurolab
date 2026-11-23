interface ToggleSwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
  disabled?: boolean
  size?: 'md' | 'sm'
  tone?: 'indigo' | 'amber'
}

export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  size = 'md',
  tone = 'indigo',
}: ToggleSwitchProps) {
  const onCls = tone === 'amber' ? 'bg-amber-600' : 'bg-indigo-600'
  const trackCls = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
  const thumbCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const posCls = checked
    ? size === 'sm'
      ? 'translate-x-[1.125rem]'
      : 'translate-x-6'
    : size === 'sm'
      ? 'translate-x-0.5'
      : 'translate-x-1'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${trackCls} shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? onCls : 'bg-slate-700'
      }`}
    >
      <span
        className={`inline-block ${thumbCls} rounded-full bg-white transition-transform ${posCls}`}
      />
    </button>
  )
}
