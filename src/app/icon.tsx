import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'
 
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#047857',
          borderRadius: '50%',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="#ecfdf5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/>
          <path d="M7 16v6"/>
          <path d="M13 19v3"/>
          <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>
        </svg>
      </div>
    ),
    { ...size }
  )
}
