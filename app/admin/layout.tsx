// The admin dashboard is always dark — it's an internal tool, and the
// SeenAI team prefers the dark glass aesthetic regardless of OS setting.
// The .force-dark class (defined in globals.css) locks the theme CSS
// variables to their dark values for this subtree.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="force-dark">{children}</div>
}
