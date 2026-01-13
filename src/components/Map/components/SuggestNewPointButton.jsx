import React, { useState } from 'react';
import {
    Button,
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Snackbar,
    IconButton,
    Checkbox,
    ListItemText,
    OutlinedInput,
} from '@mui/material';

import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import Control from 'react-leaflet-custom-control';
import axios from 'axios';
import { buttonStyle } from '../../../styles/buttonStyle';
import { useEffect } from 'react';
import { getCsrfToken } from '../../../utils/csrf';

/**
 * Button component that allows users to suggest new map points/locations.
 * Opens a dialog form with dynamically generated fields based on window.LOCATION_SCHEMA.
 * The form includes the user's position, optional photo upload, and fields for all
 * obligatory location attributes defined in the backend schema.
 * Requires user's geolocation permission to function properly.
 *
 * @returns {React.ReactElement} Button with dialog form for suggesting new points
 */
export const SuggestNewPointButton = () => {
    const [userPosition, setUserPosition] = useState({ lat: null, lng: null });
    const [showNewPointBox, setShowNewPointSuggestionBox] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoURL, setPhotoURL] = useState(null);

    // Read location schema from global object
    const locationSchema = globalThis.LOCATION_SCHEMA || { fields: {}, categories: {} };

    // Initialize dynamic form fields based on enhanced schema
    const initializeFormFields = () => {
        const fields = {};
        Object.entries(locationSchema.fields || {}).forEach(([fieldName, fieldSpec]) => {
            // Initialize based on field type from schema
            fields[fieldName] = fieldSpec.type === 'array' ? [] : '';
        });
        return fields;
    };
    const [formFields, setFormFields] = useState(initializeFormFields);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    setUserPosition({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                () => {
                    setSnackbarMessage('Please enable location services to suggest a new point.');
                    setSnackbarOpen(true);
                },
            );
        } else {
            setSnackbarMessage('Geolocation is not supported by this browser.');
            setSnackbarOpen(true);
        }
    }, []);

    const handleNewPointButton = () => {
        if (!navigator.geolocation) {
            setSnackbarMessage('Please enable location services to suggest a new point.');
            setSnackbarOpen(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            () => setShowNewPointSuggestionBox(true),
            () => {
                setSnackbarMessage('Please enable location services to suggest a new point.');
                setSnackbarOpen(true);
            },
        );
    };

    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            setSnackbarMessage('Please enable location services to suggest a new point.');
            setSnackbarOpen(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position =>
                setUserPosition({ lat: position.coords.latitude, lng: position.coords.longitude }),
            () => {
                setSnackbarMessage('Please enable location services to suggest a new point.');
                setSnackbarOpen(true);
            },
        );
    };

    const handleCloseNewPointBox = () => {
        setShowNewPointSuggestionBox(false);
    };

    const handleSnackbarClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }

        setSnackbarOpen(false);
    };

    const handlePhotoUpload = event => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const fileSizeMB = file.size / 1024 / 1024;
        if (fileSizeMB > 5) {
            setSnackbarMessage(
                'The selected file is too large. Please select a file smaller than 5MB.',
            );
            setSnackbarOpen(true);
            return;
        }
        setPhoto(file);
        setPhotoURL(URL.createObjectURL(file));
    };

    const handleFieldChange = fieldName => event => {
        setFormFields({ ...formFields, [fieldName]: event.target.value });
    };

    const handleConfirmNewPoint = async event => {
        event.preventDefault();

        // Validate user position is available
        if (userPosition.lat === null || userPosition.lng === null) {
            setSnackbarMessage(
                'Location not available. Please enable location services and try again.',
            );
            setSnackbarOpen(true);
            return;
        }

        // Validate required fields are filled
        const emptyFields = [];
        Object.entries(locationSchema.fields || {}).forEach(([fieldName, fieldSpec]) => {
            const value = formFields[fieldName];
            const isEmpty =
                fieldSpec.type === 'array'
                    ? !value || value.length === 0
                    : !value || value.trim() === '';

            if (isEmpty) {
                emptyFields.push(fieldName);
            }
        });

        if (emptyFields.length > 0) {
            setSnackbarMessage(`Please fill in required fields: ${emptyFields.join(', ')}`);
            setSnackbarOpen(true);
            return;
        }

        const formData = new FormData();
        // Convert position from {lat, lng} to [lat, lng] array format
        formData.append('position', JSON.stringify([userPosition.lat, userPosition.lng]));
        if (photo) {
            formData.append('photo', photo);
        }

        // Add all dynamic form fields
        Object.entries(formFields).forEach(([fieldName, fieldValue]) => {
            if (Array.isArray(fieldValue)) {
                formData.append(fieldName, JSON.stringify(fieldValue));
            } else {
                formData.append(fieldName, fieldValue);
            }
        });

        try {
            const csrfToken = await getCsrfToken();
            await axios.post('/api/suggest-new-point', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-CSRFToken': csrfToken,
                },
            });
            setSnackbarMessage('Location suggested successfully!');
            setSnackbarOpen(true);

            // Reset form after successful submission
            setFormFields(initializeFormFields());
            setPhoto(null);
            setPhotoURL(null);

            // Close dialog only after successful submission
            setShowNewPointSuggestionBox(false);
        } catch (error) {
            console.error('Error suggesting new point:', error);
            setSnackbarMessage('Error suggesting location. Please try again.');
            setSnackbarOpen(true);
            // Dialog stays open on error so user can retry
        }
    };

    // Render form field based on field specification from schema
    const renderFormField = (fieldName, fieldSpec) => {
        // Extract enum values from schema (for categories)
        const enumValues = fieldSpec.enum || fieldSpec.enum_items;
        const description = fieldSpec.description;

        if (fieldSpec.type === 'array' && enumValues) {
            // Multi-select for list fields with enum constraints
            return (
                <FormControl fullWidth margin="dense" key={fieldName}>
                    <InputLabel id={`${fieldName}-label`}>{fieldName}</InputLabel>
                    <Select
                        labelId={`${fieldName}-label`}
                        multiple
                        value={formFields[fieldName] || []}
                        onChange={handleFieldChange(fieldName)}
                        input={<OutlinedInput label={fieldName} />}
                        renderValue={selected => selected.join(', ')}
                        data-testid={`${fieldName}-select`}
                    >
                        {enumValues.map(option => (
                            <MenuItem key={option} value={option}>
                                <Checkbox checked={formFields[fieldName].includes(option)} />
                                <ListItemText primary={option} />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        } else if (enumValues) {
            // Single select for fields with enum constraints
            return (
                <FormControl fullWidth margin="dense" key={fieldName}>
                    <InputLabel id={`${fieldName}-label`}>{fieldName}</InputLabel>
                    <Select
                        labelId={`${fieldName}-label`}
                        value={formFields[fieldName] || ''}
                        onChange={handleFieldChange(fieldName)}
                        data-testid={`${fieldName}-select`}
                    >
                        {enumValues.map(option => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        } else {
            // Text field for non-enum fields
            return (
                <TextField
                    key={fieldName}
                    label={fieldName}
                    value={formFields[fieldName] || ''}
                    onChange={handleFieldChange(fieldName)}
                    fullWidth
                    margin="dense"
                    helperText={description}
                    data-testid={`${fieldName}-input`}
                />
            );
        }
    };

    return (
        <>
            <Button
                onClick={handleNewPointButton}
                style={buttonStyle}
                variant="contained"
                data-testid="suggest-new-point"
            >
                <AddIcon style={{ color: 'white', fontSize: 24 }} />
            </Button>

            <Dialog open={showNewPointBox} onClose={handleCloseNewPointBox}>
                <DialogTitle>Suggest a New Point</DialogTitle>
                <form onSubmit={handleConfirmNewPoint}>
                    <DialogContent>
                        <Box display="flex" alignItems="center" gap={2}>
                            <TextField
                                label="Your Position"
                                value={`${userPosition.lat}, ${userPosition.lng}`}
                                disabled
                                fullWidth
                                margin="dense"
                            />
                            <IconButton onClick={handleLocateMe}>
                                <RefreshIcon />
                            </IconButton>
                        </Box>
                        <Button variant="contained" component="label">
                            <AddAPhotoIcon />
                            <input
                                type="file"
                                hidden
                                onChange={handlePhotoUpload}
                                data-testid="photo-of-point"
                            />
                        </Button>
                        {photoURL && (
                            <img
                                src={photoURL}
                                alt="Selected"
                                style={{ width: '100%', height: 'auto' }}
                            />
                        )}

                        {/* Dynamically render form fields based on schema */}
                        {Object.entries(locationSchema.fields || {}).map(([fieldName, fieldSpec]) =>
                            renderFormField(fieldName, fieldSpec),
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button type="submit" variant="contained" color="primary">
                            Submit
                        </Button>
                        <Button
                            onClick={handleCloseNewPointBox}
                            variant="outlined"
                            color="secondary"
                        >
                            Cancel
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                message={snackbarMessage}
            />
        </>
    );
};
