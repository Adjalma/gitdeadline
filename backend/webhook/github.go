package webhook

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// GitHub Webhook payload structures (simplified)
type GHWebhook struct {
	Action     string       `json:"action"`
	Repository GHRepo       `json:"repository"`
	PullRequest *GHPullReq  `json:"pull_request,omitempty"`
	Issue      *GHIssue     `json:"issue,omitempty"`
	Sender     *GHUser      `json:"sender,omitempty"`
	Commits    []GHCommit   `json:"commits,omitempty"`
}

type GHRepo struct {
	FullName string `json:"full_name"`
	Owner    GHUser `json:"owner"`
}

type GHUser struct {
	Login string `json:"login"`
	ID    int64  `json:"id"`
}

type GHPullReq struct {
	Merged   bool   `json:"merged"`
	MergedBy *GHUser `json:"merged_by,omitempty"`
	User     GHUser `json:"user"`
}

type GHIssue struct {
	User      GHUser `json:"user"`
	State     string `json:"state"`
}

type GHCommit struct {
	Author GHCommitAuthor `json:"author"`
	SHA    string        `json:"sha"`
}

type GHCommitAuthor struct {
	Username string `json:"username"`
}

type EventProcessor interface {
	ProcessEvent(ctx context.Context, userID string, eventType string, meta map[string]interface{}) (int64, error)
}

func HandleGitHubWebhook(processor EventProcessor, secret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Bad request", 400)
			return
		}

		event := r.Header.Get("X-GitHub-Event")
		var payload GHWebhook
		if err := json.Unmarshal(body, &payload); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}

		userID, eventType := extractUserAndEvent(event, &payload)
		if userID == "" || eventType == "" {
			w.WriteHeader(http.StatusOK)
			return
		}

		meta := map[string]interface{}{
			"repo":    payload.Repository.FullName,
			"action":  payload.Action,
		}

		bonus, err := processor.ProcessEvent(r.Context(), userID, eventType, meta)
		if err != nil {
			http.Error(w, "Processing error", 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":    true,
			"bonus": bonus,
			"user":  userID,
		})
	}
}

func extractUserAndEvent(event string, p *GHWebhook) (userID string, eventType string) {
	switch event {
	case "pull_request":
		if p.PullRequest != nil && p.Action == "closed" && p.PullRequest.Merged {
			userID = p.PullRequest.User.Login
			if userID == "" && p.PullRequest.MergedBy != nil {
				userID = p.PullRequest.MergedBy.Login
			}
			eventType = "pr_merged"
			return
		}
	case "issues":
		if p.Issue != nil && p.Action == "closed" && strings.ToLower(p.Issue.State) == "closed" {
			userID = p.Issue.User.Login
			eventType = "issue_resolved"
			return
		}
	case "push":
		if len(p.Commits) > 0 {
			userID = p.Commits[0].Author.Username
			if userID == "" && p.Sender != nil {
				userID = p.Sender.Login
			}
			eventType = "commit"
			return
		}
	}
	return "", ""
}
