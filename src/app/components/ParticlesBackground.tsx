'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Engine, tsParticles } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';

const Particles = dynamic(() => import('@tsparticles/react'), {
  ssr: false,
});

const ParticlesBackground = () => {
  // Initialize particles engine once
  useEffect(() => {
    const initParticles = async () => {
      await loadSlim(tsParticles as Engine);
    };
    initParticles();
  }, []);

  const particlesOptions = {
    particles: {
      number: {
        value: 100,
      },
      size: {
        value: 3,
      },
      move: {
        speed: 1,
        direction: 'none',
      },
    },
  } as const;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -1,
      }}
    >
      <Particles id="tsparticles" options={particlesOptions} />
    </div>
  );
};

export default ParticlesBackground;