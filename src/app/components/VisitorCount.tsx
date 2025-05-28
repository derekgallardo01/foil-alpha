'use client';

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";

// Define your component for displaying the visitor count
const VisitorCount = () => {
  const [visitorCount, setVisitorCount] = useState<number>(0);

  // Function to fetch visitor count
  const fetchVisitorCount = async () => {
    try {
      const response = await fetch('/api/visitor-count');
      const data = await response.json();
  
      // Log the data to confirm the structure
      console.log('Fetched data:', data);
  
      if (data.count !== undefined) {
        setVisitorCount(data.count);
      } else {
        console.error('Error fetching visitor count: Invalid response format');
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  useEffect(() => {
    // First, fetch the initial visitor count on mount
    fetchVisitorCount();
  }, []); // Empty dependency array to run only once after the initial render

  // Increment visitor count on each page load (send POST request to update count)
  useEffect(() => {
    const incrementVisitorCount = async () => {
      try {
        await fetch('/api/visitor-count', { method: 'POST' });
        // Refetch the visitor count after incrementing it
        fetchVisitorCount();
      } catch (error) {
        console.error('Error incrementing visitor count:', error);
      }
    };

    incrementVisitorCount();
  }, []); // Run only once when the component mounts

  return (
    <Box sx={{ textAlign: "center", mt: 4 }}>
      <Typography variant="h4" sx={{ color: "white" }}>
        Total Visitors: {visitorCount}
      </Typography>
    </Box>
  );
};

export default VisitorCount;
