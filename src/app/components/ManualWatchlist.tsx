import React from "react";
import {
  Container,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Typography,
  CircularProgress,
  Button,
  TextField,
  Box,
  Link,
} from "@mui/material";
import { Snackbar } from "@mui/material";

interface WatchlistItem {
  id: string;
  retailer_name: string;
  product_title: string;
  product_url: string;
  price: string;
  date_recorded: string;
  stock_quantity: number;
  stock_status: string;
}

interface ManualWatchlistProps {
  watchlist: WatchlistItem[];
  setWatchlist: React.Dispatch<React.SetStateAction<WatchlistItem[]>>;
  newItem: WatchlistItem;
  setNewItem: React.Dispatch<React.SetStateAction<WatchlistItem>>;
  updatedQuantity: { [key: string]: number };
  setUpdatedQuantity: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
  watchlistLoading: boolean;
  openSnackbar: boolean;
  setOpenSnackbar: React.Dispatch<React.SetStateAction<boolean>>;
  snackbarMessage: string;
  setSnackbarMessage: React.Dispatch<React.SetStateAction<string>>;
}

const ManualWatchlist: React.FC<ManualWatchlistProps> = ({
  watchlist,
  setWatchlist,
  newItem,
  setNewItem,
  updatedQuantity,
  setUpdatedQuantity,
  watchlistLoading,
  openSnackbar,
  setOpenSnackbar,
  snackbarMessage,
  setSnackbarMessage,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handleAddItem = async () => {
    const parsedPrice = parseFloat(newItem.price);
    const parsedStockQuantity = Number.isFinite(newItem.stock_quantity) ? newItem.stock_quantity : 0;
  
    if (isNaN(parsedPrice) || isNaN(parsedStockQuantity)) {
      alert("Please enter valid numbers for price and stock quantity.");
      return;
    }
  
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailer_name: newItem.retailer_name,
          product_url: newItem.product_url,
          product_title: newItem.product_title,
          price: parsedPrice,
          stock_quantity: parsedStockQuantity,
          stock_status: newItem.stock_status,
          user_id: 1,
        }),
      });
  
      if (!response.ok) throw new Error(`Failed to add item: ${response.statusText}`);
      const addedItem = await response.json();
  
      if (addedItem && addedItem.newItem && addedItem.newItem.id) {
        setWatchlist((prevList) => [...prevList, addedItem.newItem]);
        setSnackbarMessage("Item added successfully to your watchlist!");
        setOpenSnackbar(true);
      }
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  };

  const handleCloseSnackbar = () => setOpenSnackbar(false);

  const handleUpdateQuantity = async (id: string, newQuantity: number) => {
    try {
      const response = await fetch(`/api/watchlist?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_quantity: newQuantity }),
      });

      if (!response.ok) throw new Error(`Error: ${response.status}`);
      const updatedItem = await response.json();

      if (updatedItem) {
        setWatchlist((prevList) =>
          prevList.map((item) => (item.id === id ? { ...item, stock_quantity: newQuantity } : item))
        );
        setUpdatedQuantity((prevState) => {
          const newState = { ...prevState };
          delete newState[id];
          return newState;
        });
      }
    } catch (error) {
      console.error("Failed to update quantity:", error);
    }
  };

  const handleToggleStockStatus = async (item: WatchlistItem) => {
    const newStatus = item.stock_status === "in_stock" ? "no_stock" : "in_stock";
    setWatchlist((prevList) =>
      prevList.map((listItem) =>
        listItem.id === item.id ? { ...listItem, stock_status: newStatus } : listItem
      )
    );

    try {
      const response = await fetch(`/api/watchlist/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update stock status");
      const updatedItem = await response.json();
      setWatchlist((prevList) =>
        prevList.map((listItem) => (listItem.id === item.id ? { ...listItem, ...updatedItem } : listItem))
      );
    } catch (error) {
      console.error("Failed to update stock status:", error);
      setWatchlist((prevList) =>
        prevList.map((listItem) =>
          listItem.id === item.id ? { ...listItem, stock_status: item.stock_status } : listItem
        )
      );
      setSnackbarMessage("Failed to update stock status. Please try again.");
      setOpenSnackbar(true);
    }
  };

  const handleQuantityChange = (id: string, value: string) => {
    setUpdatedQuantity((prevState) => ({
      ...prevState,
      [id]: parseInt(value) || 0,
    }));
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Failed to delete item: ${response.statusText}`);
      setWatchlist((prevList) => prevList.filter((item) => item.id !== id));
      setSnackbarMessage("Item deleted successfully from your watchlist!");
      setOpenSnackbar(true);
    } catch (error) {
      console.error("Failed to delete item:", error);
      setSnackbarMessage("Failed to delete item. Please try again.");
      setOpenSnackbar(true);
    }
  };

  return (
    <Container sx={{ marginTop: 4, marginBottom: 4, paddingLeft: 0, paddingRight: 0 }}>
      <Box component={Paper} sx={{ marginBottom: 2, padding: 2 }}>
        <Typography variant="h4" gutterBottom>Manual Watchlist</Typography>
        <Typography variant="h6" gutterBottom>Add Item to Watchlist</Typography>
        <TextField
          label="Retailer Name"
          value={newItem.retailer_name}
          onChange={(e) => setNewItem({ ...newItem, retailer_name: e.target.value })}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Product Title"
          value={newItem.product_title}
          onChange={(e) => setNewItem({ ...newItem, product_title: e.target.value })}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Product URL"
          value={newItem.product_url}
          onChange={(e) => setNewItem({ ...newItem, product_url: e.target.value })}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Price"
          value={newItem.price}
          onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Stock Quantity"
          value={newItem.stock_quantity}
          onChange={(e) => setNewItem({ ...newItem, stock_quantity: parseInt(e.target.value) || 0 })}
          type="number"
          fullWidth
          margin="normal"
        />
        <Button onClick={handleAddItem} variant="contained" color="primary">
          Add to Watchlist
        </Button>
      </Box>

      {watchlistLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", padding: "40px" }}>
          <CircularProgress size={40} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ width: "100%", maxHeight: "60vh", overflowY: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Retailer</TableCell>
                <TableCell>Product Title</TableCell>
                <TableCell>Product URL</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Date Recorded</TableCell>
                <TableCell>Stock Quantity</TableCell>
                <TableCell>Stock Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {watchlist.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No items in the watchlist
                  </TableCell>
                </TableRow>
              ) : (
                watchlist.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.retailer_name}</TableCell>
                    <TableCell>{item.product_title}</TableCell>
                    <TableCell>
                      <Link href={item.product_url} target="_blank" rel="noopener noreferrer">
                        View Product
                      </Link>
                    </TableCell>
                    <TableCell sx={{ fontFamily: '"JetBrains Mono Variable", monospace' }}>{item.price}</TableCell>
                    <TableCell>{formatDate(item.date_recorded)}</TableCell>
                    <TableCell>
                      <TextField
                        value={updatedQuantity[item.id] !== undefined ? updatedQuantity[item.id] : item.stock_quantity}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        type="number"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ color: item.stock_status === "in_stock" ? "success.main" : "error.main" }}>
                      {item.stock_status}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Button
                          onClick={() => handleToggleStockStatus(item)}
                          variant="contained"
                          color="secondary"
                        >
                          {item.stock_status === "in_stock" ? "Mark Out" : "Mark In"}
                        </Button>
                        <Button
                          onClick={() => handleUpdateQuantity(item.id, updatedQuantity[item.id] || item.stock_quantity)}
                          variant="contained"
                          color="primary"
                        >
                          Update
                        </Button>
                        <Button onClick={() => handleDelete(item.id)} variant="contained" color="error">
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar} message={snackbarMessage} />
    </Container>
  );
};

export default ManualWatchlist;