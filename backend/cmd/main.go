package main

import (
        "database/sql"
        "database/sql/driver"
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "os"
        "strconv"
        "strings"
        "time"
        "path/filepath"

        _ "github.com/go-sql-driver/mysql"
        "github.com/joho/godotenv"
)

// Multi-language text type
type MultiLanguageText map[string]string

// Scan implements the sql.Scanner interface for MultiLanguageText
func (m *MultiLanguageText) Scan(value interface{}) error {
	if value == nil {
		*m = make(map[string]string)
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan %T into MultiLanguageText", value)
	}
	
	if len(bytes) == 0 {
		*m = make(map[string]string)
		return nil
	}
	
	// First check if it's a string (backward compatibility)
	var str string
	if err := json.Unmarshal(bytes, &str); err == nil {
		*m = MultiLanguageText{"en": str, "ar": ""}
		return nil
	}
	
	// Otherwise unmarshal as object
	return json.Unmarshal(bytes, m)
}

// Value implements the driver.Valuer interface for MultiLanguageText
func (m MultiLanguageText) Value() (driver.Value, error) {
	if m == nil {
		return "{}", nil
	}
	return json.Marshal(m)
}

// FormField represents a field in a form
type FormField struct {
        ID          string            `json:"id"`
        Type        string            `json:"type"`
        Label       MultiLanguageText `json:"label"`
        Placeholder MultiLanguageText `json:"placeholder,omitempty"`
        Required    bool              `json:"required"`
        Options     []MultiLanguageText `json:"options,omitempty"`
        Validation  map[string]interface{} `json:"validation,omitempty"`
}

// Form represents a form definition
type Form struct {
        ID               int                `json:"id"`
        Title            MultiLanguageText  `json:"title"`
        Description      MultiLanguageText  `json:"description,omitempty"`
        Fields           []FormField        `json:"fields"`
        SubmitButtonText MultiLanguageText  `json:"submitButtonText,omitempty"`
        HeroImageUrl     string             `json:"heroImageUrl,omitempty"`
        IsActive         bool               `json:"isActive"`
        CreatedAt        time.Time          `json:"createdAt"`
        UpdatedAt        time.Time          `json:"updatedAt"`
}

// FormResponse represents a form submission
type FormResponse struct {
        ID           int                    `json:"id"`
        FormID       int                    `json:"formId"`
        PhoneNumber  string                 `json:"phoneNumber"`
        ResponseData map[string]interface{} `json:"responseData"`
        SubmittedAt  time.Time              `json:"submittedAt"`
}

// Database connection
var db *sql.DB

// Initialize database connection
func initDB() {
        var err error
        // Build MySQL DSN from environment variables
        user := os.Getenv("DB_USER")
        password := os.Getenv("DB_PASSWORD")
        host := os.Getenv("DB_HOST")
        port := os.Getenv("DB_PORT")
        dbname := os.Getenv("DB_NAME")
        if user == "" || password == "" || host == "" || port == "" || dbname == "" {
                log.Fatal("All DB_* environment variables are required (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)")
        }
        dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci", user, password, host, port, dbname)

        db, err = sql.Open("mysql", dsn)
        if err != nil {
                log.Fatalf("Error connecting to database: %v", err)
        }

        if err = db.Ping(); err != nil {
                log.Fatalf("Error pinging database: %v", err)
        }

        fmt.Println("Successfully connected to MySQL database")
}

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                w.Header().Set("Access-Control-Allow-Origin", "*")
                w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

                if r.Method == "OPTIONS" {
                        w.WriteHeader(http.StatusOK)
                        return
                }

                next.ServeHTTP(w, r)
        })
}

// Health check endpoint
func healthHandler(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusOK)
        fmt.Fprintf(w, `{"status": "healthy"}`)
}

// Create a new form
func createFormHandler(w http.ResponseWriter, r *http.Request) {
        if r.Method != "POST" {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

        var formData struct {
                Title            MultiLanguageText  `json:"title"`
                Description      MultiLanguageText  `json:"description"`
                Fields           []FormField        `json:"fields"`
                SubmitButtonText MultiLanguageText  `json:"submitButtonText"`
                HeroImageUrl     string             `json:"heroImageUrl"`
        }

        if err := json.NewDecoder(r.Body).Decode(&formData); err != nil {
                http.Error(w, "Invalid JSON", http.StatusBadRequest)
                return
        }

        // Marshal MultiLanguageText fields as JSON
        titleJSON, err := json.Marshal(formData.Title)
        if err != nil {
                http.Error(w, "Error encoding title", http.StatusInternalServerError)
                return
        }
        descriptionJSON, err := json.Marshal(formData.Description)
        if err != nil {
                http.Error(w, "Error encoding description", http.StatusInternalServerError)
                return
        }
        submitButtonTextJSON, err := json.Marshal(formData.SubmitButtonText)
        if err != nil {
                http.Error(w, "Error encoding submit button text", http.StatusInternalServerError)
                return
        }
        fieldsJSON, err := json.Marshal(formData.Fields)
        if err != nil {
                http.Error(w, "Error encoding fields", http.StatusInternalServerError)
                return
        }

        // Insert form (MySQL compatible)
        result, err := db.Exec(`
                INSERT INTO forms (title, description, fields, submit_button_text, hero_image_url, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, true, NOW(), NOW())
        `, titleJSON, descriptionJSON, fieldsJSON, submitButtonTextJSON, formData.HeroImageUrl)
        if err != nil {
                log.Printf("Error creating form: %v", err)
                http.Error(w, "Error creating form", http.StatusInternalServerError)
                return
        }
        insertedID, err := result.LastInsertId()
        if err != nil {
                log.Printf("Error getting inserted ID: %v", err)
                http.Error(w, "Error getting inserted ID", http.StatusInternalServerError)
                return
        }
        // Fetch the inserted row
        var form Form
        var heroImageUrl sql.NullString
        var fieldsJSONResult []byte
        var titleJSONResult, descriptionJSONResult, submitButtonTextJSONResult []byte
        err = db.QueryRow(`
                SELECT id, title, description, fields, submit_button_text, hero_image_url, is_active, created_at, updated_at
                FROM forms WHERE id = ?
        `, insertedID).Scan(
                &form.ID, &titleJSONResult, &descriptionJSONResult, &fieldsJSONResult, &submitButtonTextJSONResult, &heroImageUrl, &form.IsActive, &form.CreatedAt, &form.UpdatedAt,
        )
        if err != nil {
                log.Printf("Error fetching created form: %v", err)
                http.Error(w, "Error fetching created form", http.StatusInternalServerError)
                return
        }
        
        // Unmarshal JSON fields
        if err := json.Unmarshal(titleJSONResult, &form.Title); err != nil {
                log.Printf("Error unmarshaling title: %v", err)
                http.Error(w, "Error parsing title", http.StatusInternalServerError)
                return
        }
        if err := json.Unmarshal(descriptionJSONResult, &form.Description); err != nil {
                log.Printf("Error unmarshaling description: %v", err)
                http.Error(w, "Error parsing description", http.StatusInternalServerError)
                return
        }
        if err := json.Unmarshal(submitButtonTextJSONResult, &form.SubmitButtonText); err != nil {
                log.Printf("Error unmarshaling submitButtonText: %v", err)
                http.Error(w, "Error parsing submitButtonText", http.StatusInternalServerError)
                return
        }
        
        if heroImageUrl.Valid {
                form.HeroImageUrl = heroImageUrl.String
        } else {
                form.HeroImageUrl = ""
        }
        if err := json.Unmarshal(fieldsJSONResult, &form.Fields); err != nil {
                log.Printf("Error parsing fields: %v", err)
                http.Error(w, "Error parsing fields", http.StatusInternalServerError)
                return
        }
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(form)
}

// PaginatedResponse represents a paginated API response
type PaginatedResponse struct {
        Data       []Form `json:"data"`
        TotalCount int    `json:"totalCount"`
        Page       int    `json:"page"`
        PageSize   int    `json:"pageSize"`
        TotalPages int    `json:"totalPages"`
}

// Get all forms with pagination
func getFormsHandler(w http.ResponseWriter, r *http.Request) {
        if r.Method != "GET" {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

        // Parse pagination parameters
        pageStr := r.URL.Query().Get("page")
        pageSizeStr := r.URL.Query().Get("pageSize")
        
        page := 1
        pageSize := 5 // Default page size
        
        if pageStr != "" {
                if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
                        page = p
                }
        }
        
        if pageSizeStr != "" {
                if ps, err := strconv.Atoi(pageSizeStr); err == nil && ps > 0 && ps <= 50 {
                        pageSize = ps
                }
        }

        // Get total count for pagination
        var totalCount int
        err := db.QueryRow("SELECT COUNT(*) FROM forms WHERE is_active = true").Scan(&totalCount)
        if err != nil {
                http.Error(w, "Error counting forms", http.StatusInternalServerError)
                return
        }

        // Calculate total pages
        totalPages := (totalCount + pageSize - 1) / pageSize

        // Calculate offset
        offset := (page - 1) * pageSize

        // Query forms with pagination
        rows, err := db.Query(`
                SELECT id, title, description, fields, submit_button_text, hero_image_url, is_active, created_at, updated_at
                FROM forms
                WHERE is_active = true
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
        `, pageSize, offset)
        if err != nil {
                http.Error(w, "Error fetching forms", http.StatusInternalServerError)
                return
        }
        defer rows.Close()

        var forms []Form
        for rows.Next() {
                var form Form
                var fieldsJSON []byte
                var heroImageUrl sql.NullString
                var titleJSON, descriptionJSON, submitButtonTextJSON []byte

                err := rows.Scan(
                        &form.ID, &titleJSON, &descriptionJSON, &fieldsJSON, &submitButtonTextJSON, &heroImageUrl,
                        &form.IsActive, &form.CreatedAt, &form.UpdatedAt,
                )
                
                if err != nil {
                        log.Printf("Error scanning form: %v", err)
                        http.Error(w, "Error scanning form", http.StatusInternalServerError)
                        return
                }
                
                // Unmarshal JSON fields
                if err := json.Unmarshal(titleJSON, &form.Title); err != nil {
                        log.Printf("Error unmarshaling title: %v", err)
                        http.Error(w, "Error parsing title", http.StatusInternalServerError)
                        return
                }
                if err := json.Unmarshal(descriptionJSON, &form.Description); err != nil {
                        log.Printf("Error unmarshaling description: %v", err)
                        http.Error(w, "Error parsing description", http.StatusInternalServerError)
                        return
                }
                if err := json.Unmarshal(submitButtonTextJSON, &form.SubmitButtonText); err != nil {
                        log.Printf("Error unmarshaling submitButtonText: %v", err)
                        http.Error(w, "Error parsing submitButtonText", http.StatusInternalServerError)
                        return
                }
                
                // Handle NULL hero_image_url
                if heroImageUrl.Valid {
                        form.HeroImageUrl = heroImageUrl.String
                } else {
                        form.HeroImageUrl = ""
                }

                if err := json.Unmarshal(fieldsJSON, &form.Fields); err != nil {
                        log.Printf("Error unmarshaling fields: %v", err)
                        http.Error(w, "Error parsing fields", http.StatusInternalServerError)
                        return
                }

                forms = append(forms, form)
        }

        // Create paginated response
        response := PaginatedResponse{
                Data:       forms,
                TotalCount: totalCount,
                Page:       page,
                PageSize:   pageSize,
                TotalPages: totalPages,
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(response)
}

// Get a specific form by ID
func getFormHandler(w http.ResponseWriter, r *http.Request) {
        if r.Method != "GET" {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

        // Extract form ID from URL path
        path := strings.TrimPrefix(r.URL.Path, "/api/forms/")
        formID, err := strconv.Atoi(path)
        if err != nil {
                http.Error(w, "Invalid form ID", http.StatusBadRequest)
                return
        }

        var form Form
        var fieldsJSON []byte
        var heroImageUrl sql.NullString
        var titleJSON, descriptionJSON, submitButtonTextJSON []byte

        err = db.QueryRow(`
                SELECT id, title, description, fields, submit_button_text, hero_image_url, is_active, created_at, updated_at
                FROM forms
                WHERE id = ? AND is_active = true
        `, formID).Scan(
                &form.ID, &titleJSON, &descriptionJSON, &fieldsJSON, &submitButtonTextJSON, &heroImageUrl,
                &form.IsActive, &form.CreatedAt, &form.UpdatedAt,
        )

        if err == sql.ErrNoRows {
                http.Error(w, "Form not found", http.StatusNotFound)
                return
        } else if err != nil {
                log.Printf("Error fetching form: %v", err)
                http.Error(w, "Error fetching form", http.StatusInternalServerError)
                return
        }
        
        // Unmarshal JSON fields
        if err := json.Unmarshal(titleJSON, &form.Title); err != nil {
                log.Printf("Error unmarshaling title: %v", err)
                http.Error(w, "Error parsing title", http.StatusInternalServerError)
                return
        }
        if err := json.Unmarshal(descriptionJSON, &form.Description); err != nil {
                log.Printf("Error unmarshaling description: %v", err)
                http.Error(w, "Error parsing description", http.StatusInternalServerError)
                return
        }
        if err := json.Unmarshal(submitButtonTextJSON, &form.SubmitButtonText); err != nil {
                log.Printf("Error unmarshaling submitButtonText: %v", err)
                http.Error(w, "Error parsing submitButtonText", http.StatusInternalServerError)
                return
        }
        
        // Handle NULL hero_image_url
        if heroImageUrl.Valid {
                form.HeroImageUrl = heroImageUrl.String
        } else {
                form.HeroImageUrl = ""
        }

        if err := json.Unmarshal(fieldsJSON, &form.Fields); err != nil {
                http.Error(w, "Error parsing fields", http.StatusInternalServerError)
                return
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(form)
}

// Submit form response
func submitFormHandler(w http.ResponseWriter, r *http.Request) {
        if r.Method != "POST" {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

        var submission struct {
                FormID       int                    `json:"formId"`
                PhoneNumber  string                 `json:"phoneNumber"`
                ResponseData map[string]interface{} `json:"responseData"`
                Language     string                 `json:"language"`
        }

        if err := json.NewDecoder(r.Body).Decode(&submission); err != nil {
                http.Error(w, "Invalid JSON", http.StatusBadRequest)
                return
        }

        if submission.PhoneNumber == "" {
                http.Error(w, "Phone number is required", http.StatusBadRequest)
                return
        }

        // Default to English if language not specified
        if submission.Language == "" {
                submission.Language = "en"
        }

        responseDataJSON, err := json.Marshal(submission.ResponseData)
        if err != nil {
                http.Error(w, "Error encoding response data", http.StatusInternalServerError)
                return
        }

        // Insert response (MySQL compatible) with language support
        result, err := db.Exec(`
                INSERT INTO form_responses (form_id, phone_number, response_data, language, submitted_at)
                VALUES (?, ?, ?, ?, NOW())
        `, submission.FormID, submission.PhoneNumber, responseDataJSON, submission.Language)
        if err != nil {
                log.Printf("Error submitting form: %v", err)
                http.Error(w, "Error submitting form", http.StatusInternalServerError)
                return
        }
        insertedID, err := result.LastInsertId()
        if err != nil {
                log.Printf("Error getting inserted ID: %v", err)
                http.Error(w, "Error getting inserted ID", http.StatusInternalServerError)
                return
        }
        // Fetch the inserted row
        var response FormResponse
        var responseDataJSONResult []byte
        err = db.QueryRow(`
                SELECT id, form_id, phone_number, response_data, submitted_at
                FROM form_responses WHERE id = ?
        `, insertedID).Scan(
                &response.ID, &response.FormID, &response.PhoneNumber, &responseDataJSONResult, &response.SubmittedAt,
        )
        if err != nil {
                log.Printf("Error fetching submitted response: %v", err)
                http.Error(w, "Error fetching submitted response", http.StatusInternalServerError)
                return
        }
        if err := json.Unmarshal(responseDataJSONResult, &response.ResponseData); err != nil {
                log.Printf("Error parsing response data: %v", err)
                http.Error(w, "Error parsing response data", http.StatusInternalServerError)
                return
        }
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(response)
}

// Update form
func updateFormHandler(w http.ResponseWriter, r *http.Request) {
        if r.Method != "PUT" {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

        // Extract form ID from URL path
        path := strings.TrimPrefix(r.URL.Path, "/api/forms/")
        formID, err := strconv.Atoi(path)
        if err != nil {
                http.Error(w, "Invalid form ID", http.StatusBadRequest)
                return
        }

        var formData struct {
                Title            MultiLanguageText `json:"title"`
                Description      MultiLanguageText `json:"description"`
                Fields           []FormField       `json:"fields"`
                SubmitButtonText MultiLanguageText `json:"submitButtonText"`
                HeroImageUrl     string            `json:"heroImageUrl"`
        }

        if err := json.NewDecoder(r.Body).Decode(&formData); err != nil {
                http.Error(w, "Invalid JSON", http.StatusBadRequest)
                return
        }

        // Marshal MultiLanguageText fields as JSON
        titleJSON, err := json.Marshal(formData.Title)
        if err != nil {
                http.Error(w, "Error encoding title", http.StatusInternalServerError)
                return
        }
        descriptionJSON, err := json.Marshal(formData.Description)
        if err != nil {
                http.Error(w, "Error encoding description", http.StatusInternalServerError)
                return
        }
        submitButtonTextJSON, err := json.Marshal(formData.SubmitButtonText)
        if err != nil {
                http.Error(w, "Error encoding submit button text", http.StatusInternalServerError)
                return
        }
        fieldsJSON, err := json.Marshal(formData.Fields)
        if err != nil {
                http.Error(w, "Error encoding fields", http.StatusInternalServerError)
                return
        }

        // Update form (MySQL compatible)
        _, err = db.Exec(`
                UPDATE forms 
                SET title = ?, description = ?, fields = ?, submit_button_text = ?, hero_image_url = ?, updated_at = NOW()
                WHERE id = ? AND is_active = true
        `, titleJSON, descriptionJSON, fieldsJSON, submitButtonTextJSON, formData.HeroImageUrl, formID)
        if err != nil {
                log.Printf("Error updating form: %v", err)
                http.Error(w, "Error updating form", http.StatusInternalServerError)
                return
        }
        // Fetch the updated row
        var form Form
        var heroImageUrl sql.NullString
        var fieldsJSONResult []byte
        var titleJSONResult, descriptionJSONResult, submitButtonTextJSONResult []byte
        err = db.QueryRow(`
                SELECT id, title, description, fields, submit_button_text, hero_image_url, is_active, created_at, updated_at
                FROM forms WHERE id = ?
        `, formID).Scan(
                &form.ID, &titleJSONResult, &descriptionJSONResult, &fieldsJSONResult, &submitButtonTextJSONResult, &heroImageUrl, &form.IsActive, &form.CreatedAt, &form.UpdatedAt,
        )
        if err != nil {
                log.Printf("Error fetching updated form: %v", err)
                http.Error(w, "Error fetching updated form", http.StatusInternalServerError)
                return
        }
        
        // Unmarshal JSON fields
        if err := json.Unmarshal(titleJSONResult, &form.Title); err != nil {
                log.Printf("Error unmarshaling title: %v", err)
                http.Error(w, "Error parsing title", http.StatusInternalServerError)
                return
        }
        if err := json.Unmarshal(descriptionJSONResult, &form.Description); err != nil {
                log.Printf("Error unmarshaling description: %v", err)
                http.Error(w, "Error parsing description", http.StatusInternalServerError)
                return
        }
        if err := json.Unmarshal(submitButtonTextJSONResult, &form.SubmitButtonText); err != nil {
                log.Printf("Error unmarshaling submitButtonText: %v", err)
                http.Error(w, "Error parsing submitButtonText", http.StatusInternalServerError)
                return
        }
        
        if heroImageUrl.Valid {
                form.HeroImageUrl = heroImageUrl.String
        } else {
                form.HeroImageUrl = ""
        }
        if err := json.Unmarshal(fieldsJSONResult, &form.Fields); err != nil {
                log.Printf("Error parsing fields: %v", err)
                http.Error(w, "Error parsing fields", http.StatusInternalServerError)
                return
        }
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(form)
}

// Delete form
func deleteFormHandler(w http.ResponseWriter, r *http.Request) {
        if r.Method != "DELETE" {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

        // Extract form ID from URL path
        path := strings.TrimPrefix(r.URL.Path, "/api/forms/")
        formID, err := strconv.Atoi(path)
        if err != nil {
                http.Error(w, "Invalid form ID", http.StatusBadRequest)
                return
        }

        // Soft delete by setting is_active to false
        result, err := db.Exec(`
                UPDATE forms 
                SET is_active = false, updated_at = NOW()
                WHERE id = ? AND is_active = true
        `, formID)

        if err != nil {
                http.Error(w, "Error deleting form", http.StatusInternalServerError)
                return
        }

        rowsAffected, err := result.RowsAffected()
        if err != nil {
                http.Error(w, "Error checking deletion result", http.StatusInternalServerError)
                return
        }

        if rowsAffected == 0 {
                http.Error(w, "Form not found", http.StatusNotFound)
                return
        }

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusOK)
        fmt.Fprintf(w, `{"message": "Form deleted successfully"}`)
}

// Get form responses
func getFormResponsesHandler(w http.ResponseWriter, r *http.Request) {
        if r.Method != "GET" {
                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
        }

        // Extract form ID from URL path
        path := strings.TrimPrefix(r.URL.Path, "/api/forms/")
        parts := strings.Split(path, "/")
        if len(parts) != 2 || parts[1] != "responses" {
                http.Error(w, "Invalid URL format", http.StatusBadRequest)
                return
        }

        formID, err := strconv.Atoi(parts[0])
        if err != nil {
                http.Error(w, "Invalid form ID", http.StatusBadRequest)
                return
        }

        rows, err := db.Query(`
                SELECT id, form_id, phone_number, response_data, submitted_at
                FROM form_responses
                WHERE form_id = ?
                ORDER BY submitted_at DESC
        `, formID)
        if err != nil {
                http.Error(w, "Error fetching responses", http.StatusInternalServerError)
                return
        }
        defer rows.Close()

        var responses []FormResponse
        for rows.Next() {
                var response FormResponse
                var responseDataJSON []byte

                err := rows.Scan(
                        &response.ID, &response.FormID, &response.PhoneNumber,
                        &responseDataJSON, &response.SubmittedAt,
                )
                if err != nil {
                        http.Error(w, "Error scanning response", http.StatusInternalServerError)
                        return
                }

                if err := json.Unmarshal(responseDataJSON, &response.ResponseData); err != nil {
                        http.Error(w, "Error parsing response data", http.StatusInternalServerError)
                        return
                }

                responses = append(responses, response)
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(responses)
}

// migrateHeroImageHandler migrates the hero_image_url column from VARCHAR(512) to TEXT
func migrateHeroImageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Execute the ALTER TABLE statement
	_, err := db.Exec("ALTER TABLE forms MODIFY COLUMN hero_image_url TEXT")
	if err != nil {
		log.Printf("Error migrating hero_image_url column: %v", err)
		http.Error(w, "Migration failed", http.StatusInternalServerError)
		return
	}

	log.Println("Successfully migrated hero_image_url column to TEXT")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
		"message": "hero_image_url column migrated to TEXT",
	})
}

// migrateMultiLanguageHandler migrates forms to support multi-language content
func migrateMultiLanguageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Add language column to form_responses table
	_, err := db.Exec("ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS language VARCHAR(2) DEFAULT 'en'")
	if err != nil {
		log.Printf("Error adding language column to form_responses: %v", err)
		http.Error(w, "Migration failed", http.StatusInternalServerError)
		return
	}

	log.Println("Successfully migrated database for multi-language support")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Multi-language migration completed successfully",
	})
}

// Enhanced migration: log every migrated field, count total fields migrated, handle nested fields, log what it changes
func migrateFieldsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := db.Query("SELECT id, fields FROM forms")
	if err != nil {
		log.Printf("Error selecting forms for migration: %v", err)
		http.Error(w, "Error selecting forms", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	updatedForms := 0
	updatedFields := 0
	for rows.Next() {
		var formID int
		var fieldsJSON []byte
		if err := rows.Scan(&formID, &fieldsJSON); err != nil {
			log.Printf("Error scanning form for migration: %v", err)
			continue
		}

		var fields []map[string]interface{}
		if err := json.Unmarshal(fieldsJSON, &fields); err != nil {
			log.Printf("Error unmarshaling fields for migration (form %d): %v", formID, err)
			continue
		}

		changed := false
		for i, field := range fields {
			// Migrate label
			if label, ok := field["label"].(string); ok {
				log.Printf("Migrating label for form %d, field %d: %s", formID, i, label)
				field["label"] = map[string]string{"en": label, "ar": ""}
				changed = true
				updatedFields++
			}
			// Migrate placeholder
			if placeholder, ok := field["placeholder"].(string); ok {
				log.Printf("Migrating placeholder for form %d, field %d: %s", formID, i, placeholder)
				field["placeholder"] = map[string]string{"en": placeholder, "ar": ""}
				changed = true
				updatedFields++
			}
			// Migrate options (array of strings)
			if options, ok := field["options"].([]interface{}); ok && len(options) > 0 {
				allStrings := true
				for _, opt := range options {
					if _, ok := opt.(string); !ok {
						allStrings = false
						break
					}
				}
				if allStrings {
					log.Printf("Migrating options for form %d, field %d", formID, i)
					newOpts := make([]map[string]string, len(options))
					for j, opt := range options {
						newOpts[j] = map[string]string{"en": opt.(string), "ar": ""}
						updatedFields++
					}
					field["options"] = newOpts
					changed = true
				}
			}
		}

		if changed {
			newFieldsJSON, err := json.Marshal(fields)
			if err != nil {
				log.Printf("Error marshaling migrated fields for form %d: %v", formID, err)
				continue
			}
			_, err = db.Exec("UPDATE forms SET fields = ? WHERE id = ?", newFieldsJSON, formID)
			if err != nil {
				log.Printf("Error updating migrated fields for form %d: %v", formID, err)
				continue
			}
			updatedForms++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"migrated_forms": updatedForms, "migrated_fields": updatedFields})
}

func migrateLanguageColumnHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Add language column to form_responses table
	_, err := db.Exec(`
		ALTER TABLE form_responses 
		ADD COLUMN language VARCHAR(10) DEFAULT 'en' 
		AFTER response_data
	`)
	if err != nil {
		log.Printf("Error adding language column: %v", err)
		http.Error(w, "Error adding language column", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Language column added successfully"})
}

// Route handler
func setupRoutes() {
        // Health check
        http.HandleFunc("/health", healthHandler)
        http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusOK)
                fmt.Fprintf(w, `{"message": "Dynamic Form Creator API", "status": "ok"}`)
        })

        // API routes
        http.HandleFunc("/api/forms", func(w http.ResponseWriter, r *http.Request) {
                if r.Method == "POST" {
                        createFormHandler(w, r)
                } else if r.Method == "GET" {
                        getFormsHandler(w, r)
                } else {
                        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                }
        })

        http.HandleFunc("/api/forms/", func(w http.ResponseWriter, r *http.Request) {
                path := strings.TrimPrefix(r.URL.Path, "/api/forms/")
                if strings.Contains(path, "/responses") {
                        getFormResponsesHandler(w, r)
                } else {
                        if r.Method == "GET" {
                                getFormHandler(w, r)
                        } else if r.Method == "PUT" {
                                updateFormHandler(w, r)
                        } else if r.Method == "DELETE" {
                                deleteFormHandler(w, r)
                        } else {
                                http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
                        }
                }
        })

        http.HandleFunc("/api/submit", submitFormHandler)
        http.HandleFunc("/migrate-hero-image", migrateHeroImageHandler)
        http.HandleFunc("/migrate-multi-language", migrateMultiLanguageHandler)
        http.HandleFunc("/migrate-fields", migrateFieldsHandler)
        http.HandleFunc("/migrate-language-column", migrateLanguageColumnHandler)
}

// main is the entry point of the Dynamic Form Creator API
func main() {
        fmt.Println("Dynamic Form Creator API")
        fmt.Println("========================")

        // Load .env from project root
        _ = godotenv.Load(filepath.Join("..", ".env"))

        // Initialize database
        initDB()
        defer db.Close()

        // Setup routes
        setupRoutes()

        // Get port from environment variable, default to 5000 for Replit compatibility
        port := os.Getenv("SERVER_PORT")
        if port == "" {
                port = os.Getenv("PORT")
        }
        if port == "" {
                port = "5000"
        }

        // Create server with CORS middleware
        handler := corsMiddleware(http.DefaultServeMux)

        // Start the HTTP server
        fmt.Printf("Server starting on port %s...\n", port)
        fmt.Printf("API Documentation:\n")
        fmt.Printf("  POST   /api/forms - Create a new form\n")
        fmt.Printf("  GET    /api/forms - Get all forms\n")
        fmt.Printf("  GET    /api/forms/{id} - Get specific form\n")
        fmt.Printf("  PUT    /api/forms/{id} - Update existing form\n")
        fmt.Printf("  DELETE /api/forms/{id} - Delete form (soft delete)\n")
        fmt.Printf("  POST   /api/submit - Submit form response\n")
        fmt.Printf("  GET    /api/forms/{id}/responses - Get form responses\n")
        
        if err := http.ListenAndServe("0.0.0.0:"+port, handler); err != nil {
                log.Fatalf("Server failed to start: %v", err)
        }
}
