import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';
import Tooltip from '@mui/material/Tooltip';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import Control from 'react-leaflet-custom-control';
import { useTranslation } from 'react-i18next';
import { buttonStyle, getLocationAwareStyles } from '../../../styles/buttonStyle';
import { getCsrfToken } from '../../../utils/csrf';
import { useLocation } from '../context/LocationContext';

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
    const { t } = useTranslation();
    const { locationGranted, userPosition, requestGeolocation } = useLocation();
    const [showNewPointBox, setShowNewPointSuggestionBox] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoURL, setPhotoURL] = useState(null);

    // Read location schema from global object
    const locationSchema = globalThis.LOCATION_SCHEMA || { obligatory_fields: [], categories: {} };

    // Initialize dynamic form fields based on schema
    const initializeFormFields = () => {
        const fields = {};
        locationSchema.obligatory_fields.forEach(([fieldName, fieldType]) => {
            // Skip uuid - it's generated on backend
            if (fieldName === 'uuid') {
                return;
            }
            if (fieldType === 'list') {
                fields[fieldName] = [];
            } else {
                fields[fieldName] = '';
            }
        });
        return fields;
    };

    const [formFields, setFormFields] = useState(initializeFormFields);

    const handleNewPointButton = () => {
        requestGeolocation(() => setShowNewPointSuggestionBox(true));
    };

    const handleLocateMe = () => {
        requestGeolocation(null, () => {
            setSnackbarMessage(t('locationServicesDisabled'));
            setSnackbarOpen(true);
        });
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
        if (!userPosition || userPosition.lat === null || userPosition.lng === null) {
            setSnackbarMessage(
                'Location not available. Please enable location services and try again.',
            );
            setSnackbarOpen(true);
            return;
        }

        // Validate required fields are filled
        const emptyFields = [];
        locationSchema.obligatory_fields.forEach(([fieldName, fieldType]) => {
            if (fieldName === 'uuid') return; // Skip uuid - generated on backend

            const value = formFields[fieldName];
            const isEmpty =
                fieldType === 'list' ? !value || value.length === 0 : !value || value.trim() === '';

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
            const response = await fetch('/api/suggest-new-point', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                },
                body: formData,
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
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

    // Render form field based on field type and whether it's a category
    const renderFormField = (fieldName, fieldType) => {
        const isCategory = fieldName in locationSchema.categories;
        const categoryOptions = isCategory ? locationSchema.categories[fieldName] : [];

        if (fieldType === 'list' && isCategory) {
            // Multi-select for list categories
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
                        {categoryOptions.map(option => (
                            <MenuItem key={option} value={option}>
                                <Checkbox checked={formFields[fieldName].includes(option)} />
                                <ListItemText primary={option} />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        } else if (isCategory) {
            // Single select for category fields
            return (
                <FormControl fullWidth margin="dense" key={fieldName}>
                    <InputLabel id={`${fieldName}-label`}>{fieldName}</InputLabel>
                    <Select
                        labelId={`${fieldName}-label`}
                        value={formFields[fieldName] || ''}
                        onChange={handleFieldChange(fieldName)}
                        data-testid={`${fieldName}-select`}
                    >
                        {categoryOptions.map(option => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        } else {
            // Text field for non-category fields
            return (
                <TextField
                    key={fieldName}
                    label={fieldName}
                    value={formFields[fieldName] || ''}
                    onChange={handleFieldChange(fieldName)}
                    fullWidth
                    margin="dense"
                    data-testid={`${fieldName}-input`}
                />
            );
        }
    };

    return (
        <>
            <Tooltip
                title={locationGranted ? t('suggestNewPoint') : t('locationServicesDisabled')}
                placement="left"
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={1500}
            >
                <Button
                    onClick={handleNewPointButton}
                    variant="contained"
                    data-testid="suggest-new-point"
                    sx={{
                        ...buttonStyle,
                        ...getLocationAwareStyles(locationGranted),
                    }}
                >
                    <AddIcon style={{ color: 'white', fontSize: 24 }} />
                </Button>
            </Tooltip>

            <Dialog open={showNewPointBox} onClose={handleCloseNewPointBox}>
                <DialogTitle>Suggest a New Point</DialogTitle>
                <form onSubmit={handleConfirmNewPoint}>
                    <DialogContent>
                        <Box display="flex" alignItems="center" gap={2}>
                            <TextField
                                label="Your Position"
                                value={
                                    userPosition ? `${userPosition.lat}, ${userPosition.lng}` : ''
                                }
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
                        {locationSchema.obligatory_fields
                            .filter(([fieldName]) => fieldName !== 'uuid')
                            .map(([fieldName, fieldType]) => renderFormField(fieldName, fieldType))}
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
