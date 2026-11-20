/* eslint-disable */
import React from "react";

const Globe: React.FC = () => {
  return (
    <>
      <style>
        {`
          @keyframes earthRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes orbFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          @keyframes orbAtmosphereGlow {
            0%, 100% {
              filter: drop-shadow(0 0 25px rgba(245, 158, 11, 0.4)) drop-shadow(0 0 60px rgba(239, 68, 68, 0.25));
            }
            50% {
              filter: drop-shadow(0 0 35px rgba(34, 197, 94, 0.5)) drop-shadow(0 0 75px rgba(59, 130, 246, 0.3));
            }
          }
          @keyframes twinkling { 0%,100% { opacity:0.1; } 50% { opacity:1; } }
          @keyframes twinkling-slow { 0%,100% { opacity:0.1; } 50% { opacity:1; } }
          @keyframes twinkling-long { 0%,100% { opacity:0.1; } 50% { opacity:1; } }
          @keyframes twinkling-fast { 0%,100% { opacity:0.1; } 50% { opacity:1; } }
        `}
      </style>
      <div className="flex items-center justify-center h-screen">
        <div
          className="relative w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] rounded-full overflow-hidden shadow-[0_0_35px_rgba(245,158,11,0.4),0_0_70px_rgba(239,68,68,0.3),inset_0_0_30px_rgba(0,0,0,0.85)]"
          style={{
            animation: "orbAtmosphereGlow 6s ease-in-out infinite, orbFloat 8s ease-in-out infinite",
          }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              backgroundImage: "url('/winter-smog-orb.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              animation: "earthRotate 40s linear infinite",
            }}
          />

          {/* Atmospheric Air Quality Starfield */}
          <div
            className="absolute left-[-20px] w-1.5 h-1.5 bg-amber-300 rounded-full shadow-[0_0_8px_#f59e0b]"
            style={{ animation: "twinkling 3s infinite" }}
          />
          <div
            className="absolute left-[-40px] top-[30px] w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_6px_#10b981]"
            style={{ animation: "twinkling-slow 2s infinite" }}
          />
          <div
            className="absolute left-[350px] top-[90px] w-1.5 h-1.5 bg-rose-400 rounded-full shadow-[0_0_8px_#f43f5e]"
            style={{ animation: "twinkling-long 4s infinite" }}
          />
          <div
            className="absolute left-[200px] top-[290px] w-1 h-1 bg-cyan-300 rounded-full shadow-[0_0_6px_#06b6d4]"
            style={{ animation: "twinkling 3s infinite" }}
          />
          <div
            className="absolute left-[50px] top-[270px] w-1 h-1 bg-amber-400 rounded-full shadow-[0_0_6px_#f59e0b]"
            style={{ animation: "twinkling-fast 1.5s infinite" }}
          />
          <div
            className="absolute left-[250px] top-[-50px] w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff]"
            style={{ animation: "twinkling-long 4s infinite" }}
          />
          <div
            className="absolute left-[290px] top-[60px] w-1 h-1 bg-sky-300 rounded-full shadow-[0_0_6px_#38bdf8]"
            style={{ animation: "twinkling-slow 2s infinite" }}
          />
        </div>
      </div>
    </>
  );
};

export default Globe;

