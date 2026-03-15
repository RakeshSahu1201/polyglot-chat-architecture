package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type registerRequest struct {
	Name     string `json:"name"     binding:"required,min=2"`
	Password string `json:"password" binding:"required,min=4"`
}

type loginRequest struct {
	Name     string `json:"name"     binding:"required"`
	Password string `json:"password" binding:"required"`
}

// POST /auth/register
func Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashed, err := HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	user, err := CreateUser(c.Request.Context(), req.Name, hashed)
	if err != nil {
		// unique name violation
		c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
		return
	}

	token, err := IssueJWT(user.ID, user.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"user":  gin.H{"_id": user.ID, "name": user.Name},
		"token": token,
	})
}

// POST /auth/login
func Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := GetUserByName(c.Request.Context(), req.Name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	if !CheckPassword(user.Password, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid password"})
		return
	}

	token, err := IssueJWT(user.ID, user.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user":  gin.H{"_id": user.ID, "name": user.Name},
		"token": token,
	})
}

// GET /auth/me  (requires Auth middleware)
func Me(c *gin.Context) {
	userID, _ := c.Get("userID")

	user, err := GetUserByID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": gin.H{"_id": user.ID, "name": user.Name}})
}

// GET /users  (requires Auth middleware)
func GetUsersHandler(c *gin.Context) {
	users, err := GetUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	// Map to the shape the frontend might expect if needed
	var response []gin.H
	for _, u := range users {
		response = append(response, gin.H{"_id": u.ID, "name": u.Name})
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}
