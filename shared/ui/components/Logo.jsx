import { Link } from 'react-router-dom'
import logo from '../assets/rudras-logo.png'
import './Logo.css'

export default function Logo({ to = '/', tone = 'dark' }) {
  return (
    <Link to={to} className={`logo logo--${tone}`} aria-label="Rudras Farm Fresh home">
      <img className="logo__image" src={logo} alt="" width="72" height="72" />
    </Link>
  )
}
