export default function Spinner({ size = 24 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid #e5e5e3`,
      borderTopColor: '#3867EB',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      margin: '0 auto',
    }} />
  )
}
