"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type User = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
};

type ClearanceItem = {
  id: string;
  status: string;
  comment?: string | null;
  correctionComment?: string | null;
  reviewedAt?: string | null;
  unit?: {
    code?: string;
    name?: string;
  };
  templateItem?: {
    name?: string;
    description?: string | null;
    isRequired?: boolean;
  };
};

type ClearanceRequest = {
  id: string;
  requestNumber: string;
  status: string;
  createdAt: string;
  submittedAt?: string | null;
  completedAt?: string | null;
  student?: {
    studentId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    user?: {
      email?: string;
    };
  };
  template?: {
    name?: string;
  };
  workflow?: {
    name?: string;
  };
  items?: ClearanceItem[];
};

type Decision = "APPROVED" | "REJECTED" | "RETURNED" | "NOT_APPLICABLE";

const REVIEW_ROLES = [
  "ADMINISTRATOR",
  "SUPER_ADMINISTRATOR",
  "REGISTRAR",
  "CLEARANCE_STAFF",
  "FINANCE_OFFICER",
  "LIBRARY_OFFICER",
  "PROPERTY_OFFICER",
];

const REVIEWABLE_REQUEST_STATUSES = [
  "SUBMITTED",
  "IN_PROGRESS",
  "ACTION_REQUIRED",
];

const REVIEWABLE_ITEM_STATUSES = ["PENDING", "IN_REVIEW"];

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) =>
    c.toUpperCase()
  );
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "An unexpected error occurred.";
  }

  try {
    const parsed = JSON.parse(error.message);
    return parsed.message ?? error.message;
  } catch {
    return error.message;
  }
}

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<ClearanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedRequest, setSelectedRequest] =
    useState<ClearanceRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [comments, setComments] = useState<Record<string, string>>({});
  const [reviewingItemId, setReviewingItemId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");

  const roles = user?.roles ?? [];

  const isAdmin = roles.some((role) =>
    ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"].includes(role)
  );

  const canReview = roles.some((role) => REVIEW_ROLES.includes(role));

  const counts = useMemo(
    () => ({
      total: requests.length,
      actionRequired: requests.filter(
        (r) => r.status === "ACTION_REQUIRED"
      ).length,
      completed: requests.filter((r) => r.status === "COMPLETED").length,
      pending: requests.filter(
        (r) =>
          ["SUBMITTED", "IN_REVIEW", "PENDING", "IN_PROGRESS"].includes(
            r.status
          )
      ).length,
    }),
    [requests]
  );

  const loadRequests = useCallback(async (token: string) => {
    const data = await apiRequest<ClearanceRequest[]>(
      "/clearance/requests",
      {},
      token
    );

    setRequests(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const token = sessionStorage.getItem("epsu_access_token");
      const storedUser = sessionStorage.getItem("epsu_user");

      if (!token || !storedUser) {
        router.replace("/login");
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser) as User;

        if (!cancelled) {
          setUser(parsedUser);
          await loadRequests(token);
        }
      } catch (err) {
        if (!cancelled) {
          const message = errorMessage(err);

          if (
            message.includes("401") ||
            message.toLowerCase().includes("unauthorized")
          ) {
            sessionStorage.removeItem("epsu_access_token");
            sessionStorage.removeItem("epsu_user");
            router.replace("/login");
            return;
          }

          setError("Could not load clearance requests. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router, loadRequests]);

  async function openRequest(requestId: string) {
    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    setSelectedRequest(null);
    setDetailError("");
    setDetailLoading(true);
    setReviewError("");
    setReviewMessage("");

    try {
      const data = await apiRequest<ClearanceRequest>(
        `/clearance/requests/${requestId}`,
        {},
        token
      );

      setSelectedRequest(data);
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshSelectedRequest(requestId: string) {
    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const data = await apiRequest<ClearanceRequest>(
      `/clearance/requests/${requestId}`,
      {},
      token
    );

    setSelectedRequest(data);
  }

  async function reviewItem(item: ClearanceItem, decision: Decision) {
    if (!selectedRequest) return;

    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const comment = (comments[item.id] ?? "").trim();

    if (
      (decision === "REJECTED" || decision === "RETURNED") &&
      !comment
    ) {
      setReviewError(
        "A comment is required when rejecting an item or returning it for correction."
      );
      setReviewMessage("");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${formatStatus(decision).toLowerCase()} this clearance item?`
    );

    if (!confirmed) return;

    setReviewingItemId(item.id);
    setReviewError("");
    setReviewMessage("");

    try {
      await apiRequest(
        `/clearance/requests/${selectedRequest.id}/items/${item.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            ...(comment ? { comment } : {}),
          }),
        },
        token
      );

      await Promise.all([
        loadRequests(token),
        refreshSelectedRequest(selectedRequest.id),
      ]);

      setComments((previous) => ({
        ...previous,
        [item.id]: "",
      }));

      setReviewMessage(
        `Item successfully updated to ${formatStatus(decision)}.`
      );
    } catch (err) {
      setReviewError(errorMessage(err));
    } finally {
      setReviewingItemId(null);
    }
  }

  function logout() {
    sessionStorage.removeItem("epsu_access_token");
    sessionStorage.removeItem("epsu_user");
    router.replace("/login");
  }

  const requestCanBeReviewed =
    !!selectedRequest &&
    REVIEWABLE_REQUEST_STATUSES.includes(selectedRequest.status);

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">E</div>
          <div>
            <strong>EPSU</strong>
            <span>Clearance Portal</span>
          </div>
        </div>

        <p className="nav-label">{isAdmin ? "ADMIN MENU" : "USER MENU"}</p>

        {(isAdmin
          ? ["Overview", "All Clearances", "Profile"]
          : ["Overview", "My Clearance", "Apply for Clearance", "Profile"]
        ).map((item) => (
          <button
            key={item}
            className="nav-item"
            onClick={() => {
              if (item === "Apply for Clearance") {
                alert("The application form will be connected in the next step.");
              } else if (
                item === "All Clearances" ||
                item === "My Clearance"
              ) {
                document.getElementById("requests")?.scrollIntoView({
                  behavior: "smooth",
                });
              } else if (item === "Profile") {
                alert(
                  `Username: ${user?.username ?? ""}\nEmail: ${user?.email ?? ""}`
                );
              } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <span className="nav-dot" />
            {item}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="help-icon">?</div>
          <div>
            <strong>Need help?</strong>
            <p>Contact the clearance office.</p>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">ETHIOPIAN PUBLIC SERVICE UNIVERSITY</p>
            <h1>
              {isAdmin ? "Clearance Administration" : "Student Clearance"}
            </h1>
          </div>

          <div className="user-profile">
            <div className="avatar">
              {user
                ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`
                : "U"}
            </div>
            <div>
              <strong>{user?.username ?? "Loading user..."}</strong>
              <span>{isAdmin ? "Administrator" : "User Portal"}</span>
            </div>
            <button className="text-button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <p className="muted">
                {isAdmin ? "ADMINISTRATOR DASHBOARD" : "USER DASHBOARD"}
              </p>
              <h2>
                Welcome back,{" "}
                <span>
                  {user
                    ? `${user.firstName} ${user.lastName}`.trim() ||
                      user.username
                    : "User"}
                </span>
                !
              </h2>
              <p className="subheading">
                {isAdmin
                  ? "Monitor clearance requests and review individual clearance items."
                  : "Manage your clearance application and track your progress."}
              </p>
            </div>
          </div>

          {loading && (
            <section className="panel">Loading clearance requests...</section>
          )}

          {!loading && error && (
            <section className="panel">
              <h3>Unable to load dashboard</h3>
              <p role="alert">{error}</p>
              <button
                className="primary-button"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </section>
          )}

          {!loading && !error && (
            <>
              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-top">
                    <span>Total requests</span>
                    <span className="stat-icon blue">#</span>
                  </div>
                  <h3>{counts.total}</h3>
                  <p>Requests retrieved from the API</p>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span>Action required</span>
                    <span className="stat-icon gold">!</span>
                  </div>
                  <h3>{counts.actionRequired}</h3>
                  <p>Requests needing attention</p>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span>Completed</span>
                    <span className="stat-icon purple">✓</span>
                  </div>
                  <h3>{counts.completed}</h3>
                  <p>Completed requests</p>
                </article>
              </section>

              <section className="panel" id="requests">
                <div className="section-heading">
                  <div>
                    <h3>
                      {isAdmin ? "Clearance requests" : "My clearance requests"}
                    </h3>
                    <p>Live data retrieved from the backend.</p>
                  </div>
                  <span className="status-pill">{counts.pending} pending</span>
                </div>

                {requests.length === 0 ? (
                  <p className="panel-description">
                    No clearance requests were returned for this account.
                  </p>
                ) : (
                  <div className="department-list">
                    {requests.map((request) => (
                      <div className="department-row" key={request.id}>
                        <div className="department-info">
                          <div className="department-icon">C</div>
                          <div>
                            <strong>{request.requestNumber}</strong>
                            <span>
                              {request.student
                                ? `${request.student.firstName ?? ""} ${request.student.lastName ?? ""}`.trim() ||
                                  `Created ${new Date(request.createdAt).toLocaleDateString()}`
                                : `Created ${new Date(request.createdAt).toLocaleDateString()}`}
                            </span>
                          </div>
                        </div>

                        <div className="request-row-actions">
                          <span className="pending-pill">
                            {formatStatus(request.status)}
                          </span>
                          <button
                            className="primary-button"
                            onClick={() => openRequest(request.id)}
                          >
                            View details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {(detailLoading || detailError || selectedRequest) && (
                <section className="panel review-panel" id="request-details">
                  <div className="section-heading">
                    <div>
                      <h3>Clearance request details</h3>
                      <p>Inspect the request and review its individual items.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelectedRequest(null);
                        setDetailError("");
                        setReviewError("");
                        setReviewMessage("");
                      }}
                    >
                      Close
                    </button>
                  </div>

                  {detailLoading && <p>Loading request details...</p>}

                  {detailError && (
                    <p className="review-error" role="alert">
                      {detailError}
                    </p>
                  )}

                  {selectedRequest && (
                    <>
                      <div className="request-summary">
                        <div>
                          <span>Request number</span>
                          <strong>{selectedRequest.requestNumber}</strong>
                        </div>
                        <div>
                          <span>Request status</span>
                          <strong>
                            {formatStatus(selectedRequest.status)}
                          </strong>
                        </div>
                        <div>
                          <span>Student</span>
                          <strong>
                            {selectedRequest.student
                              ? `${selectedRequest.student.firstName ?? ""} ${selectedRequest.student.lastName ?? ""}`.trim() ||
                                "Student name unavailable"
                              : "Student information unavailable"}
                          </strong>
                        </div>
                        <div>
                          <span>Student ID</span>
                          <strong>
                            {selectedRequest.student?.studentId ?? "Not provided"}
                          </strong>
                        </div>
                        <div>
                          <span>Template</span>
                          <strong>
                            {selectedRequest.template?.name ?? "Not specified"}
                          </strong>
                        </div>
                        <div>
                          <span>Created</span>
                          <strong>
                            {new Date(
                              selectedRequest.createdAt
                            ).toLocaleDateString()}
                          </strong>
                        </div>
                      </div>

                      <div className="section-heading item-heading">
                        <div>
                          <h3>Clearance items</h3>
                          <p>
                            Review each item according to the responsible unit.
                          </p>
                        </div>
                        <span className="status-pill">
                          {selectedRequest.items?.length ?? 0} items
                        </span>
                      </div>

                      {!selectedRequest.items?.length ? (
                        <p className="panel-description">
                          No clearance items are associated with this request.
                        </p>
                      ) : (
                        <div className="review-item-list">
                          {selectedRequest.items.map((item) => {
                            const itemCanBeReviewed =
                              canReview &&
                              requestCanBeReviewed &&
                              REVIEWABLE_ITEM_STATUSES.includes(item.status);

                            return (
                              <article className="review-item" key={item.id}>
                                <div className="review-item-header">
                                  <div>
                                    <h4>
                                      {item.templateItem?.name ??
                                        "Clearance item"}
                                    </h4>
                                    <p>
                                      {item.templateItem?.description ??
                                        "No description provided."}
                                    </p>
                                  </div>
                                  <span className="pending-pill">
                                    {formatStatus(item.status)}
                                  </span>
                                </div>

                                <div className="review-item-meta">
                                  <span>
                                    Unit:{" "}
                                    <strong>
                                      {item.unit?.name ?? "Unassigned"}
                                    </strong>
                                  </span>
                                  <span>
                                    Required:{" "}
                                    <strong>
                                      {item.templateItem?.isRequired === false
                                        ? "No"
                                        : "Yes"}
                                    </strong>
                                  </span>
                                </div>

                                {item.comment && (
                                  <p className="item-comment">
                                    <strong>Review comment:</strong>{" "}
                                    {item.comment}
                                  </p>
                                )}

                                {item.correctionComment && (
                                  <p className="item-comment">
                                    <strong>Correction comment:</strong>{" "}
                                    {item.correctionComment}
                                  </p>
                                )}

                                {itemCanBeReviewed && (
                                  <div className="review-controls">
                                    <label htmlFor={`comment-${item.id}`}>
                                      Review comment
                                    </label>
                                    <textarea
                                      id={`comment-${item.id}`}
                                      value={comments[item.id] ?? ""}
                                      onChange={(event) =>
                                        setComments((previous) => ({
                                          ...previous,
                                          [item.id]: event.target.value,
                                        }))
                                      }
                                      placeholder="Add a comment. Required for rejection or return."
                                      rows={3}
                                      maxLength={1000}
                                      disabled={reviewingItemId === item.id}
                                    />

                                    <div className="review-actions">
                                      <button
                                        className="review-button approve"
                                        disabled={reviewingItemId === item.id}
                                        onClick={() =>
                                          reviewItem(item, "APPROVED")
                                        }
                                      >
                                        Approve
                                      </button>
                                      <button
                                        className="review-button reject"
                                        disabled={reviewingItemId === item.id}
                                        onClick={() =>
                                          reviewItem(item, "REJECTED")
                                        }
                                      >
                                        Reject
                                      </button>
                                      <button
                                        className="review-button return"
                                        disabled={reviewingItemId === item.id}
                                        onClick={() =>
                                          reviewItem(item, "RETURNED")
                                        }
                                      >
                                        Return for correction
                                      </button>
                                      <button
                                        className="review-button neutral"
                                        disabled={reviewingItemId === item.id}
                                        onClick={() =>
                                          reviewItem(item, "NOT_APPLICABLE")
                                        }
                                      >
                                        Not applicable
                                      </button>
                                    </div>

                                    {reviewingItemId === item.id && (
                                      <p>Saving review...</p>
                                    )}
                                  </div>
                                )}

                                {!itemCanBeReviewed && (
                                  <p className="review-readonly">
                                    {item.status === "APPROVED" ||
                                    item.status === "REJECTED" ||
                                    item.status === "RETURNED" ||
                                    item.status === "NOT_APPLICABLE"
                                      ? "This item has already been reviewed."
                                      : !canReview
                                        ? "Your account does not have permission to review items."
                                        : "This request is not currently open for review."}
                                  </p>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      )}

                      {reviewError && (
                        <p className="review-error" role="alert">
                          {reviewError}
                        </p>
                      )}

                      {reviewMessage && (
                        <p className="review-success" role="status">
                          {reviewMessage}
                        </p>
                      )}
                    </>
                  )}
                </section>
              )}
            </>
          )}

          <footer className="footer">
            <span>© 2026 Ethiopian Public Service University</span>
            <span>Student Clearance Management System</span>
          </footer>
        </div>
      </section>
    </main>
  );
}