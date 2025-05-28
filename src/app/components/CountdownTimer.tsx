"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  targetDate: string; // Target date in ISO format
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0); 

  useEffect(() => {
    const targetTime = new Date(targetDate).getTime();

    if (isNaN(targetTime)) {
      console.error("Invalid target date.");
      return;
    }

    const interval = setInterval(() => {
      const currentTime = new Date().getTime();
      const remainingTime = targetTime - currentTime;

      if (remainingTime <= 0) {
        clearInterval(interval);
        setTimeRemaining(0);
        setProgress(100); 
      } else {
        setTimeRemaining(remainingTime);
        // Calculate totalTime inside the interval:
        const totalTime = targetTime - new Date().getTime(); 
        setProgress(((totalTime - remainingTime) / totalTime) * 100);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]); 

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div>
        <h2>Time Remaining:</h2>
        <h3>{formatTime(timeRemaining)}</h3>
      </div>
      <div style={{ width: "100%", marginTop: "20px" }}>
        <progress value={progress} max={100} style={{ width: "100%", height: "10px" }} />
      </div>
    </div>
  );
};

export default CountdownTimer;