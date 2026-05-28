import { Brand } from './Brand.jsx'

export function PortalShell({ subtitle, actions, children, mainClassName = 'container' }) {
  return (
    <div className="appShell">
      <div className="bg-layer" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />
      <header className="topbar">
        <Brand subtitle={subtitle} />
        {actions ? <div className="topbarActions">{actions}</div> : null}
      </header>
      <main className={mainClassName}>{children}</main>
    </div>
  )
}
