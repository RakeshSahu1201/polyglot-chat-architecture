package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/polyglot-chat/go-service/ent"
	"github.com/polyglot-chat/go-service/pkg/db"
	"github.com/polyglot-chat/go-service/pkg/logs"
)

type registerRequest struct {
	Name     string `json:"name"     binding:"required,min=2"`
	Password string `json:"password" binding:"required,min=4"`
}

type loginRequest struct {
	Name     string `json:"name"     binding:"required"`
	Password string `json:"password" binding:"required"`
}

func clientError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

// POST /auth/register
func Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logs.Info("auth register: invalid request", "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusBadRequest, "Please provide a valid username and password")
		return
	}

	hashed, err := HashPassword(req.Password)
	if err != nil {
		logs.Info("auth register: hash password failed", "username", req.Name, "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusInternalServerError, "Unable to create account right now")
		return
	}

	user, err := CreateUser(c.Request.Context(), req.Name, hashed)
	if err != nil {
		if ent.IsConstraintError(err) {
			logs.Info("auth register: username already taken", "username", req.Name, "ip", c.ClientIP())
			clientError(c, http.StatusConflict, "That username is already taken")
			return
		}

		logs.Info("auth register: create user failed", "username", req.Name, "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusInternalServerError, "Unable to create account right now")
		return
	}

	token, err := IssueJWT(user.ID, user.Name)
	if err != nil {
		logs.Info("auth register: issue token failed", "user_id", user.ID, "username", user.Name, "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusInternalServerError, "Account created, but login could not be completed")
		return
	}

	logs.Info("auth register: success", "user_id", user.ID, "username", user.Name, "ip", c.ClientIP())
	c.JSON(http.StatusCreated, gin.H{
		"user":  gin.H{"_id": user.ID, "name": user.Name},
		"token": token,
	})
}

// POST /auth/login
func Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logs.Info("auth login: invalid request", "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusBadRequest, "Please enter both username and password")
		return
	}

	user, err := GetUserByName(c.Request.Context(), req.Name)
	if err != nil {
		if ent.IsNotFound(err) {
			logs.Info("auth login: unknown username", "username", req.Name, "ip", c.ClientIP())
			clientError(c, http.StatusUnauthorized, "Invalid username or password")
			return
		}

		logs.Info("auth login: lookup failed", "username", req.Name, "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusInternalServerError, "Unable to log in right now")
		return
	}

	if !CheckPassword(user.Password, req.Password) {
		logs.Info("auth login: invalid password", "user_id", user.ID, "username", user.Name, "ip", c.ClientIP())
		clientError(c, http.StatusUnauthorized, "Invalid username or password")
		return
	}

	token, err := IssueJWT(user.ID, user.Name)
	if err != nil {
		logs.Info("auth login: issue token failed", "user_id", user.ID, "username", user.Name, "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusInternalServerError, "Login succeeded, but session creation failed")
		return
	}

	logs.Info("auth login: success", "user_id", user.ID, "username", user.Name, "ip", c.ClientIP())
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
		if ent.IsNotFound(err) {
			logs.Info("auth me: user not found", "user_id", userID.(string), "ip", c.ClientIP())
			clientError(c, http.StatusNotFound, "User not found")
			return
		}

		logs.Info("auth me: lookup failed", "user_id", userID.(string), "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusInternalServerError, "Unable to load your profile right now")
		return
	}

	logs.Info("auth me: success", "user_id", user.ID, "ip", c.ClientIP())
	c.JSON(http.StatusOK, gin.H{"user": gin.H{"_id": user.ID, "name": user.Name}})
}

// GET /users  (requires Auth middleware)
func GetUsersHandler(c *gin.Context) {
	users, err := GetUsers(c.Request.Context())
	if err != nil {
		logs.Info("auth users: list failed", "ip", c.ClientIP(), "error", err)
		clientError(c, http.StatusInternalServerError, "Unable to load users right now")
		return
	}

	// Map to the shape the frontend might expect if needed
	var response []gin.H
	for _, u := range users {
		response = append(response, gin.H{"_id": u.ID, "name": u.Name})
	}

	logs.Info("auth users: success", "count", len(response), "ip", c.ClientIP())
	c.JSON(http.StatusOK, gin.H{"data": response})
}

// POST /auth/logout (requires Auth middleware)
func Logout(c *gin.Context) {
	jti, _ := c.Get("jti")
	userID, _ := c.Get("userID")

	if jtiStr, ok := jti.(string); ok && jtiStr != "" {
		// Write to redis
		// we know token expiration is 7 days
		if db.Redis != nil {
			err := db.Redis.Set(c.Request.Context(), "blacklist:"+jtiStr, "revoked", 7*24*time.Hour).Err()
			if err != nil {
				logs.Info("auth logout: redis blacklist failed", "jti", jtiStr, "error", err)
			}
		}
	}

	logs.Info("auth logout: success", "user_id", userID, "ip", c.ClientIP())
	c.JSON(http.StatusOK, gin.H{"success": true})
}
