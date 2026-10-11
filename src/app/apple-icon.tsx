import { ImageResponse } from 'next/og'

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
          backgroundColor: '#059669',
        }}
      >
        <svg 
          width="264" height="264" style={{ marginBottom: '16px' }} 
          viewBox="-2 0 28 28" 
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M 14.086 18.412 A 2 2 0 0 1 12.67 19 H 5 V 11.328 A 2 2 0 0 1 5.586 9.914 L 11.75 3.75 a 6.003 6.003 0 1 1 8.49 8.49 z" />
          <path d="M 16 8 L 0 24 q 2.625 -3 5.25 0 t 5.25 0 q 2.625 -3 5.25 0 t 5.25 0" />
          <path d="M 20.4 11 H 18.5" />
          <path d="M 13 3.6 V 5.5" />
          <path d="M 16.7 15 H 14.7" />
          <path d="M 9 7.3 V 9.3" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
