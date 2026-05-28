export function Brand({ subtitle }) {
  return (
    <div className="brand">
      <img className="brandLogo" src={`${import.meta.env.BASE_URL}favicon-32x32.png`} alt="Zyoris" width={36} height={36} />
      <div>
        <div className="brandTitle">zyoris</div>
        {subtitle ? <div className="brandSubtitle">{subtitle}</div> : null}
      </div>
    </div>
  )
}
