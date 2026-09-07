export function Card({ title, tone = 'quiet', ...props }) {
  return <article {...props} className="p-6 rounded-xl bg-white w-[220px]">
    <h2 className="type-editorial">{title}</h2>
    <p>{tone}</p>
  </article>;
}
