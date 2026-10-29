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
type StudentProfile = {
  id: string;
  studentId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  isActive: boolean;
  department?: { id: string; name: string };
  program?: { id: string; name: string };
};

type ClearanceTemplate = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  clearanceType: string;
  isActive: boolean;
};

type ClearanceUnit = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

type ClearanceTemplateItem = {
  id: string;
  name: string;
  description?: string | null;
  isRequired: boolean;
  order: number;
  templateId: string;
  unitId: string;
  unit?: { id: string; code: string; name: string };
};

type ClearanceWorkflow = {
  id: string;
  code: string;
  name: string;
  templateId: string;
  isActive: boolean;
};


const REVIEW_ROLES = [
  "ADMINISTRATOR",
  "SUPER_ADMINISTRATOR",
  "REGISTRAR",
  "CLEARANCE_STAFF",
  "FINANCE_OFFICER",
  "LIBRARY_OFFICER",
  "PROPERTY_OFFICER",
  "DORMITORY_OFFICER",
  "COLLEGE_OFFICER",
  "DEPARTMENT_STAFF"
];

const REVIEWABLE_REQUEST_STATUSES = [
  "SUBMITTED",
  "IN_PROGRESS",
  "ACTION_REQUIRED",
];

const REVIEWABLE_ITEM_STATUSES = ["PENDING", "IN_REVIEW", "WAITING"];

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) =>
    c.toUpperCase()
  );
}


function getClearanceProgress(request: ClearanceRequest) {
  const items = request.items ?? [];

  const stages = [
    { name: "Library", keywords: ["LIBRARY"] },
    { name: "Property", keywords: ["PROPERTY"] },
    { name: "Dormitory", keywords: ["DORMITORY", "DORM"] },
    { name: "Finance", keywords: ["FINANCE"] },
    { name: "Department", keywords: ["DEPARTMENT"] },
    { name: "College", keywords: ["COLLEGE"] },
  ];

  const approvedStatuses = ["APPROVED"];

  const dependencies: Record<string, string[]> = {
    Finance: ["Library", "Property", "Dormitory"],
    Department: ["Finance"],
    College: ["Department"],
  };

  const results: { name: string; status: string }[] = [];

  for (const stage of stages) {
    const item = items.find((entry) => {
      const unitName =
        `${entry.unit?.code ?? ""} ${entry.unit?.name ?? ""} ${entry.templateItem?.name ?? ""}`
          .toUpperCase();

      return stage.keywords.some((keyword) =>
        unitName.includes(keyword)
      );
    });

    const prerequisitesMet = (
      dependencies[stage.name] ?? []
    ).every((dependency) =>
      results.find((result) => result.name === dependency)?.status ===
      "Approved"
    );

    if (!item) {
      results.push({
        name: stage.name,
        status: prerequisitesMet ? "Not configured" : "Waiting",
      });
      continue;
    }

    const rawStatus = item.status.toUpperCase();

    if (approvedStatuses.includes(rawStatus)) {
      results.push({
        name: stage.name,
        status: "Approved",
      });
    } else if (["REJECTED", "RETURNED"].includes(rawStatus)) {
      results.push({
        name: stage.name,
        status: formatStatus(rawStatus),
      });
    } else if (!prerequisitesMet) {
      results.push({
        name: stage.name,
        status: "Waiting",
      });
    } else {
      results.push({
        name: stage.name,
        status: formatStatus(rawStatus),
      });
    }
  }

  results.push({
    name: "Registrar",
    status:
      request.status === "COMPLETED"
        ? "Approved"
        : request.status === "ACTION_REQUIRED"
          ? "Action required"
          : "Waiting",
  });

  return results;
}

function getClearanceItemForOffice(
  request: ClearanceRequest,
  officeName: string,
): ClearanceItem | undefined {
  const keywords: Record<string, string[]> = {
    Library: ["LIBRARY"],
    Property: ["PROPERTY"],
    Dormitory: ["DORMITORY", "DORM"],
    Finance: ["FINANCE"],
    Department: ["DEPARTMENT"],
    College: ["COLLEGE"],
    Registrar: ["REGISTRAR"],
  };

  const officeKeywords = keywords[officeName] ?? [];

  return (request.items ?? []).find((item) => {
    const searchableText =
      `${item.unit?.code ?? ""} ${item.unit?.name ?? ""} ${item.templateItem?.name ?? ""}`
        .toUpperCase();

    return officeKeywords.some((keyword) =>
      searchableText.includes(keyword),
    );
  });
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
const [expandedOffice, setExpandedOffice] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<ClearanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

const [templates, setTemplates] = useState<ClearanceTemplate[]>([]);
const [workflows, setWorkflows] = useState<ClearanceWorkflow[]>([]);
const [selectedTemplateId, setSelectedTemplateId] = useState("");
const [clearanceType, setClearanceType] = useState("SEMESTER");

const [otherReason, setOtherReason] = useState("");


  const [dashboardProgressRequest, setDashboardProgressRequest] = useState<ClearanceRequest | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<ClearanceRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [comments, setComments] = useState<Record<string, string>>({});
  const [reviewingItemId, setReviewingItemId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
const [libraryView, setLibraryView] = useState<"requests" | "history">("requests");
const [libraryRequestDetails, setLibraryRequestDetails] = useState<ClearanceRequest[]>([]);
const [propertyView, setPropertyView] = useState<"requests" | "history">("requests");
const [propertyRequestDetails, setPropertyRequestDetails] = useState<ClearanceRequest[]>([]);
const [showApplicationForm, setShowApplicationForm] = useState(false);
const [showConfigurationPanel, setShowConfigurationPanel] = useState(false);
const [departmentView, setDepartmentView] = useState<"requests" | "history">("requests");
const [departmentRequestDetails, setDepartmentRequestDetails] = useState<ClearanceRequest[]>([]);
const [collegeView, setCollegeView] = useState<"requests" | "history">("requests");
const [collegeRequestDetails, setCollegeRequestDetails] = useState<ClearanceRequest[]>([]);
const [dormitoryView, setDormitoryView] = useState<"requests" | "history">("requests");
  const [registrarView, setRegistrarView] = useState<"requests" | "history">("requests");
const [dormitoryRequestDetails, setDormitoryRequestDetails] = useState<ClearanceRequest[]>([]);
const [financeView, setFinanceView] = useState<"requests" | "history">("requests");
const [financeRequestDetails, setFinanceRequestDetails] = useState<ClearanceRequest[]>([]);
const [studentProfile, setStudentProfile] =
  useState<StudentProfile | null>(null);


const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
const [applicationLoading, setApplicationLoading] = useState(false);
const [applicationSubmitting, setApplicationSubmitting] = useState(false);
const [applicationError, setApplicationError] = useState("");
const [applicationMessage, setApplicationMessage] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateClearanceType, setTemplateClearanceType] =
    useState("SEMESTER");
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [itemTemplateId, setItemTemplateId] = useState("");
  const [clearanceUnits, setClearanceUnits] = useState<ClearanceUnit[]>([]);
  const [templateItems, setTemplateItems] = useState<ClearanceTemplateItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemUnitId, setItemUnitId] = useState("");
  const [itemIsRequired, setItemIsRequired] = useState(true);
  const [itemOrder, setItemOrder] = useState("0");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [itemError, setItemError] = useState("");
  const [itemMessage, setItemMessage] = useState("");
  const roles = user?.roles ?? [];
  const isLibraryOfficer = roles.includes("LIBRARY_OFFICER");
  const isPropertyOfficer = roles.includes("PROPERTY_OFFICER");
  const isDormitoryOfficer = roles.includes("DORMITORY_OFFICER");
  const isFinanceOfficer = roles.includes("FINANCE_OFFICER");
  const isDepartmentOfficer = roles.includes("DEPARTMENT_STAFF");
  const isRegistrar = roles.includes("REGISTRAR");
  const isCollegeOfficer = roles.includes("COLLEGE_OFFICER");

  const isAdmin = roles.some((role) =>
    ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"].includes(role)
  );

  useEffect(() => {
    if (showConfigurationPanel && isAdmin) {
      void loadClearanceUnits();
    }
  }, [showConfigurationPanel, isAdmin]);

  const canReview = roles.some((role) => REVIEW_ROLES.includes(role));

const processedDepartmentStatuses = [
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "NOT_APPLICABLE",
];

const visibleRequests = isRegistrar
  ? requests.filter((request) =>
      registrarView === "history"
        ? request.status === "COMPLETED"
        : REVIEWABLE_REQUEST_STATUSES.includes(request.status)
    )
  : isCollegeOfficer
  ? collegeRequestDetails.filter((request) => {
      const item = (request.items ?? []).find(
        (entry) => entry.unit?.code?.trim().toUpperCase() === "COLLEGE"
      );
      if (!item) return false;
      const processed = processedDepartmentStatuses.includes(item.status.toUpperCase());
      return collegeView === "history" ? processed : !processed;
    })
  : isDepartmentOfficer
    ? departmentRequestDetails.filter((request) => {
        const item = (request.items ?? []).find(
          (entry) => entry.unit?.code?.trim().toUpperCase() === "DEPARTMENT"
        );
        if (!item) return false;
        const processed = processedDepartmentStatuses.includes(item.status.toUpperCase());
        return departmentView === "history" ? processed : !processed;
      })
    : isDormitoryOfficer
      ? dormitoryRequestDetails.filter((request) => {
          const item = (request.items ?? []).find(
            (entry) => entry.unit?.code?.trim().toUpperCase() === "DORMITORY"
          );
          if (!item) return false;
          const processed = processedDepartmentStatuses.includes(item.status.toUpperCase());
          return dormitoryView === "history" ? processed : !processed;
        })
      : isFinanceOfficer
        ? financeRequestDetails.filter((request) => {
            const item = (request.items ?? []).find(
              (entry) => entry.unit?.code?.trim().toUpperCase() === "FINANCE"
            );
            if (!item) return false;
            const processed = processedDepartmentStatuses.includes(item.status.toUpperCase());
            return financeView === "history" ? processed : !processed;
          })
        : isLibraryOfficer
          ? libraryRequestDetails.filter((request) => {
              const item = (request.items ?? []).find(
                (entry) => entry.unit?.code?.trim().toUpperCase() === "LIBRARY"
              );
              if (!item) return false;
              const processed = processedDepartmentStatuses.includes(item.status.toUpperCase());
              return libraryView === "history" ? processed : !processed;
            })
          : isPropertyOfficer
            ? propertyRequestDetails.filter((request) => {
                const item = (request.items ?? []).find(
                  (entry) => entry.unit?.code?.trim().toUpperCase() === "PROPERTY"
                );
                if (!item) return false;
                const processed = processedDepartmentStatuses.includes(item.status.toUpperCase());
                return propertyView === "history" ? processed : !processed;
              })
            : requests;

useEffect(() => {
  if (!isDepartmentOfficer || requests.length === 0) {
    setDepartmentRequestDetails([]);
    return;
  }

  let cancelled = false;
  const token = sessionStorage.getItem("epsu_access_token");

  if (!token) {
    setDepartmentRequestDetails([]);
    return;
  }

  void Promise.all(
    requests.map(async (request) => {
      try {
        return await apiRequest<ClearanceRequest>(
          `/clearance/requests/${request.id}`,
          {},
          token
        );
      } catch {
        return null;
      }
    })
  ).then((details) => {
    if (!cancelled) {
      setDepartmentRequestDetails(
        details.filter(
          (request): request is ClearanceRequest => request !== null
        )
      );
    }
  });

  return () => {
    cancelled = true;
  };
}, [isDepartmentOfficer, requests]);

  useEffect(() => {
    if (!isCollegeOfficer || requests.length === 0) {
      setCollegeRequestDetails([]);
      return;
    }

    let cancelled = false;
    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      setCollegeRequestDetails([]);
      return;
    }

    void Promise.all(
      requests.map(async (request) => {
        try {
          return await apiRequest<ClearanceRequest>(
            `/clearance/requests/${request.id}`,
            {},
            token
          );
        } catch {
          return null;
        }
      })
    ).then((details) => {
      if (!cancelled) {
        setCollegeRequestDetails(
          details.filter(
            (request): request is ClearanceRequest => request !== null
          )
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isCollegeOfficer, requests]);

  useEffect(() => {
    if (!isDormitoryOfficer || requests.length === 0) {
      setDormitoryRequestDetails([]);
      return;
    }

    let cancelled = false;
    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      setDormitoryRequestDetails([]);
      return;
    }

    void Promise.all(
      requests.map(async (request) => {
        try {
          return await apiRequest<ClearanceRequest>(
            `/clearance/requests/${request.id}`,
            {},
            token
          );
        } catch {
          return null;
        }
      })
    ).then((details) => {
      if (!cancelled) {
        setDormitoryRequestDetails(
          details.filter(
            (request): request is ClearanceRequest => request !== null
          )
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isDormitoryOfficer, requests]);
  useEffect(() => {
    if (!isFinanceOfficer || requests.length === 0) {
      setFinanceRequestDetails([]);
      return;
    }

    let cancelled = false;
    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      setFinanceRequestDetails([]);
      return;
    }

    void Promise.all(
      requests.map(async (request) => {
        try {
          return await apiRequest<ClearanceRequest>(
            `/clearance/requests/${request.id}`,
            {},
            token
          );
        } catch {
          return null;
        }
      })
    ).then((details) => {
      if (!cancelled) {
        setFinanceRequestDetails(
          details.filter(
            (request): request is ClearanceRequest => request !== null
          )
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isFinanceOfficer, requests]);
  useEffect(() => {
    if (!isLibraryOfficer || requests.length === 0) {
      setLibraryRequestDetails([]);
      return;
    }

    let cancelled = false;
    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      setLibraryRequestDetails([]);
      return;
    }

    void Promise.all(
      requests.map(async (request) => {
        try {
          return await apiRequest<ClearanceRequest>(
            `/clearance/requests/${request.id}`,
            {},
            token
          );
        } catch {
          return null;
        }
      })
    ).then((details) => {
      if (!cancelled) {
        setLibraryRequestDetails(
          details.filter(
            (request): request is ClearanceRequest => request !== null
          )
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLibraryOfficer, requests]);

  useEffect(() => {
    if (!isPropertyOfficer || requests.length === 0) {
      setPropertyRequestDetails([]);
      return;
    }

    let cancelled = false;
    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      setPropertyRequestDetails([]);
      return;
    }

    void Promise.all(
      requests.map(async (request) => {
        try {
          return await apiRequest<ClearanceRequest>(
            `/clearance/requests/${request.id}`,
            {},
            token
          );
        } catch {
          return null;
        }
      })
    ).then((details) => {
      if (!cancelled) {
        setPropertyRequestDetails(
          details.filter(
            (request): request is ClearanceRequest => request !== null
          )
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isPropertyOfficer, requests]);
  // AUTO-LOAD STUDENT PROFILE
  useEffect(() => {
    if (!user || canReview) return;

    const storedToken = sessionStorage.getItem("epsu_access_token");
    if (!storedToken) return;
    const token: string = storedToken;

    let cancelled = false;

    async function loadStudentProfile() {
      try {
        const profile = await apiRequest<StudentProfile>(
          "/students/me",
          {},
          token
        );

        if (!cancelled) {
          setStudentProfile(profile);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load student profile:", err);
        }
      }
    }

    void loadStudentProfile();

    return () => {
      cancelled = true;
    };
  }, [user, canReview]);
  const counts = useMemo(() => {
  if (isCollegeOfficer) {
    const collegeRequests = collegeRequestDetails.filter(
      (request) =>
        (request.items ?? []).some(
          (item) =>
            item.unit?.code?.trim().toUpperCase() === "COLLEGE"
        )
    );

    const collegeStatuses = collegeRequests.map((request) => {
      const item = (request.items ?? []).find(
        (entry) =>
          entry.unit?.code?.trim().toUpperCase() === "COLLEGE"
      );
      return item?.status.toUpperCase() ?? "";
    });

    return {
      total: collegeRequests.length,
      actionRequired: collegeStatuses.filter(
        (status) => ["REJECTED", "RETURNED"].includes(status)
      ).length,
      completed: collegeStatuses.filter(
        (status) => ["APPROVED", "NOT_APPLICABLE"].includes(status)
      ).length,
      pending: collegeStatuses.filter(
        (status) => !processedDepartmentStatuses.includes(status)
      ).length,
    };
  }

  if (isDepartmentOfficer) {
    const departmentRequests = departmentRequestDetails.filter(
      (request) =>
        (request.items ?? []).some(
          (item) =>
            item.unit?.code?.trim().toUpperCase() === "DEPARTMENT"
        )
    );

    const departmentStatuses = departmentRequests.map((request) => {
      const item = (request.items ?? []).find(
        (entry) =>
          entry.unit?.code?.trim().toUpperCase() === "DEPARTMENT"
      );
      return item?.status.toUpperCase() ?? "";
    });

    return {
      total: departmentRequests.length,
      actionRequired: departmentStatuses.filter(
        (status) => ["REJECTED", "RETURNED"].includes(status)
      ).length,
      completed: departmentStatuses.filter(
        (status) => ["APPROVED", "NOT_APPLICABLE"].includes(status)
      ).length,
      pending: departmentStatuses.filter(
        (status) => !processedDepartmentStatuses.includes(status)
      ).length,
    };
  }

  if (isDormitoryOfficer) {
    const dormitoryRequests = dormitoryRequestDetails.filter(
      (request) =>
        (request.items ?? []).some(
          (item) =>
            item.unit?.code?.trim().toUpperCase() === "DORMITORY"
        )
    );

    const dormitoryStatuses = dormitoryRequests.map((request) => {
      const item = (request.items ?? []).find(
        (entry) =>
          entry.unit?.code?.trim().toUpperCase() === "DORMITORY"
      );
      return item?.status.toUpperCase() ?? "";
    });

    return {
      total: dormitoryRequests.length,
      actionRequired: dormitoryStatuses.filter(
        (status) => ["REJECTED", "RETURNED"].includes(status)
      ).length,
      completed: dormitoryStatuses.filter(
        (status) => ["APPROVED", "NOT_APPLICABLE"].includes(status)
      ).length,
      pending: dormitoryStatuses.filter(
        (status) => !processedDepartmentStatuses.includes(status)
      ).length,
    };
  }
  return {
    total: requests.length,
    actionRequired: requests.filter(
      (request) => request.status === "ACTION_REQUIRED"
    ).length,
    completed: requests.filter(
      (request) => request.status === "COMPLETED"
    ).length,
    pending: requests.filter(
      (request) =>
        ["SUBMITTED", "IN_REVIEW", "PENDING", "IN_PROGRESS"].includes(
          request.status
        )
    ).length,
  };
}, [requests, isCollegeOfficer, collegeRequestDetails, isDepartmentOfficer, departmentRequestDetails, isDormitoryOfficer, dormitoryRequestDetails]);
const loadRequests = useCallback(async (token: string) => {
  const data = await apiRequest<ClearanceRequest[]>(
    "/clearance/requests",
    {},
    token
  );

  const requestList = Array.isArray(data) ? data : [];
  setRequests(requestList);

  const progressCandidate =
    requestList.find((request) => request.status === "ACTION_REQUIRED") ??
    requestList.find((request) => request.status !== "COMPLETED") ??
    requestList[0];

  if (!progressCandidate) {
    setDashboardProgressRequest(null);
    return;
  }

  try {
    const details = await apiRequest<ClearanceRequest>(
      `/clearance/requests/${progressCandidate.id}`,
      {},
      token
    );

    setDashboardProgressRequest(details);
  } catch (err) {
    console.error("Failed to load clearance progress:", err);
    setDashboardProgressRequest(null);
  }
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
  async function finalizeRegistrarApproval() {
    if (!selectedRequest || !isRegistrar) return;

    const requestId = selectedRequest.id;
    const unresolvedItems = (selectedRequest.items ?? []).filter(
      (item) =>
        item.templateItem?.isRequired &&
        item.status !== "APPROVED"
    );

    if (!["SUBMITTED", "IN_PROGRESS"].includes(selectedRequest.status)) {
      setReviewError("This request is not eligible for final Registrar approval.");
      setReviewMessage("");
      return;
    }

    if (unresolvedItems.length > 0) {
      setReviewError(
        "Final approval requires every required clearance item to be approved."
      );
      setReviewMessage("");
      return;
    }

    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    if (
      !window.confirm(
        "Confirm final Registrar approval for this clearance request?"
      )
    ) {
      return;
    }

    setReviewingItemId("registrar-final-approval");
    setReviewError("");
    setReviewMessage("");

    try {
      await apiRequest(
        `/clearance/requests/${requestId}/final-approval`,
        { method: "POST" },
        token
      );

      await Promise.all([
        loadRequests(token),
        refreshSelectedRequest(requestId),
      ]);

      setReviewMessage("Final Registrar approval completed successfully.");
    } catch (err) {
      setReviewError(errorMessage(err));
    } finally {
      setReviewingItemId(null);
    }
  }
  async function loadAdminTemplates() {
    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    setTemplateError("");

    try {
      const data = await apiRequest<ClearanceTemplate[]>(
        "/clearance/templates",
        {},
        token
      );

      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      setTemplateError(
        err instanceof Error
          ? err.message
          : "Unable to load clearance templates."
      );
    }
  }

  async function createClearanceTemplate(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const token = sessionStorage.getItem("epsu_access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const code = templateCode.trim().toUpperCase();
    const name = templateName.trim();
    const description = templateDescription.trim();

    if (code.length < 2 || code.length > 30) {
      setTemplateError("Template code must contain 2–30 characters.");
      return;
    }

    if (name.length < 2 || name.length > 120) {
      setTemplateError("Template name must contain 2–120 characters.");
      return;
    }

    setTemplateSubmitting(true);
    setTemplateError("");
    setTemplateMessage("");

    try {
      const created = await apiRequest<ClearanceTemplate>(
        "/clearance/templates",
        {
          method: "POST",
          body: JSON.stringify({
            code,
            name,
            description: description || undefined,
            clearanceType: templateClearanceType,
          }),
        },
        token
      );

      const data = await apiRequest<ClearanceTemplate[]>(
        "/clearance/templates",
        {},
        token
      );

      setTemplates(Array.isArray(data) ? data : []);
      setTemplateCode("");
      setTemplateName("");
      setTemplateDescription("");
      setTemplateClearanceType("SEMESTER");
      setTemplateMessage(
        `Template "${created.name}" was created successfully.`
      );
    } catch (err) {
      setTemplateError(
        err instanceof Error
          ? err.message
          : "Unable to create the clearance template."
      );
    } finally {
      setTemplateSubmitting(false);
    }
  }
async function loadClearanceUnits() {
  const token = sessionStorage.getItem("epsu_access_token");

  if (!token) {
    router.replace("/login");
    return;
  }

  try {
    const data = await apiRequest<ClearanceUnit[]>(
      "/clearance/units",
      {},
      token
    );

    const activeUnits = Array.isArray(data)
      ? data.filter((unit) => unit.isActive)
      : [];

    setClearanceUnits(activeUnits);

    if (itemUnitId && !activeUnits.some((unit) => unit.id === itemUnitId)) {
      setItemUnitId("");
    }
  } catch (err) {
    setItemError(
      err instanceof Error ? err.message : "Unable to load clearance units."
    );
  }
}

async function loadTemplateItems(templateId: string) {
  if (!templateId) {
    setTemplateItems([]);
    return;
  }

  const token = sessionStorage.getItem("epsu_access_token");

  if (!token) {
    router.replace("/login");
    return;
  }

  setItemsLoading(true);
  setItemError("");
  setItemMessage("");

  try {
    const data = await apiRequest<ClearanceTemplateItem[]>(
      `/clearance/templates/${templateId}/items`,
      {},
      token
    );

    setTemplateItems(Array.isArray(data) ? data : []);
  } catch (err) {
    setTemplateItems([]);
    setItemError(
      err instanceof Error ? err.message : "Unable to load template items."
    );
  } finally {
    setItemsLoading(false);
  }
}

async function createTemplateItem(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  const token = sessionStorage.getItem("epsu_access_token");

  if (!token) {
    router.replace("/login");
    return;
  }

  const name = itemName.trim();
  const description = itemDescription.trim();
  const order = Number(itemOrder);

  if (!itemTemplateId) {
    setItemError("Select a clearance template first.");
    return;
  }

  if (name.length < 2 || name.length > 120) {
    setItemError("Item name must contain 2–120 characters.");
    return;
  }

  if (!itemUnitId) {
    setItemError("Select the responsible clearance unit.");
    return;
  }

  if (!Number.isInteger(order) || order < 0) {
    setItemError("Display order must be a whole number of zero or greater.");
    return;
  }

  setItemSubmitting(true);
  setItemError("");
  setItemMessage("");

  try {
    await apiRequest<ClearanceTemplateItem>(
      `/clearance/templates/${itemTemplateId}/items`,
      {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          unitId: itemUnitId,
          isRequired: itemIsRequired,
          order,
        }),
      },
      token
    );

    await loadTemplateItems(itemTemplateId);
    setItemName("");
    setItemDescription("");
    setItemIsRequired(true);
    setItemOrder("0");
    setItemMessage("Clearance item added successfully.");
  } catch (err) {
    setItemError(
      err instanceof Error ? err.message : "Unable to create the clearance item."
    );
  } finally {
    setItemSubmitting(false);
  }
}
async function openApplicationForm() {
  setShowApplicationForm(true);
  setApplicationError("");
  setApplicationMessage("");
  setApplicationLoading(true);

  const token = sessionStorage.getItem("epsu_access_token");

  if (!token) {
    router.replace("/login");
    return;
  }

  try {
const [profile, templateData, workflowData] = await Promise.all([
  apiRequest<StudentProfile>("/students/me", {}, token),
  apiRequest<ClearanceTemplate[]>("/clearance/templates", {}, token),
  apiRequest<ClearanceWorkflow[]>("/clearance/workflows", {}, token),
]);

    if (!profile.isActive) {
      throw new Error("Your student profile is inactive. Contact the registrar.");
    }

    const activeTemplates = (Array.isArray(templateData) ? templateData : [])
      .filter((template) => template.isActive);

    const activeWorkflows = (Array.isArray(workflowData) ? workflowData : [])
      .filter((workflow) => workflow.isActive);

    setStudentProfile(profile);
setTemplates(activeTemplates);
setWorkflows(activeWorkflows);



    const matchingTemplate = activeTemplates.find(
      (template) => template.clearanceType === clearanceType
    );

    setSelectedTemplateId(matchingTemplate?.id ?? "");

    const matchingWorkflow = activeWorkflows.find(
      (workflow) => workflow.templateId === matchingTemplate?.id
    );

    setSelectedWorkflowId(matchingWorkflow?.id ?? "");

    if (!matchingTemplate) {
      setApplicationError(
        `No active template is configured for ${clearanceType} clearance. Please contact the administrator.`
      );
    } else if (!matchingWorkflow) {
      setApplicationError(
        `No active workflow is configured for ${clearanceType} clearance. Please contact the administrator.`
      );
    }
  } catch (err) {
    setApplicationError(errorMessage(err));
  } finally {
    setApplicationLoading(false);
  }
}


async function submitApplication() {
  const token = sessionStorage.getItem("epsu_access_token");

  if (!token) {
    router.replace("/login");
    return;
  }

  if (!studentProfile || !selectedTemplateId || !selectedWorkflowId) {
    setApplicationError(
      "Please ensure your student profile, template, and matching workflow are available."
    );
    return;
  }


  if (clearanceType === "OTHER" && !otherReason.trim()) {
    setApplicationError("Please provide a reason for clearance.");
    return;
  }

  const matchingTemplate = templates.find(
    (template) =>
      template.id === selectedTemplateId &&
      template.isActive &&
      template.clearanceType === clearanceType
  );

  if (!matchingTemplate) {
    setApplicationError(
      "The selected clearance template does not match the chosen clearance type."
    );
    return;
  }

  const matchingWorkflow = workflows.find(
    (workflow) =>
      workflow.id === selectedWorkflowId &&
      workflow.templateId === matchingTemplate.id &&
      workflow.isActive
  );

  if (!matchingWorkflow) {
    setApplicationError(
      "No active workflow is configured for the selected clearance template."
    );
    return;
  }

  setApplicationSubmitting(true);
  setApplicationError("");
  setApplicationMessage("");

  try {
    const created = await apiRequest<ClearanceRequest>(
      "/clearance/requests",
      {
        method: "POST",
        body: JSON.stringify({
          studentId: studentProfile.id,
          templateId: selectedTemplateId,
          workflowId: selectedWorkflowId,
          clearanceType,

          otherReason:
            clearanceType === "OTHER" ? otherReason.trim() : undefined,
        }),
      },
      token
    );

    try {
      await apiRequest(
        `/clearance/requests/${created.id}/submit`,
        { method: "POST" },
        token
      );

      setApplicationMessage(
        `Clearance request ${created.requestNumber} was submitted successfully.`
      );
    } catch (submitError) {
      setApplicationMessage(
        `Request ${created.requestNumber} was created as a draft, but submission failed: ${errorMessage(submitError)}`
      );
    }

    await loadRequests(token);
    setShowApplicationForm(false);
  } catch (err) {
    setApplicationError(errorMessage(err));
  } finally {
    setApplicationSubmitting(false);
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

  const selectedItems = isLibraryOfficer
    ? (selectedRequest?.items ?? []).filter(
        (item) => item.unit?.code?.trim().toUpperCase() === "LIBRARY"
      )
    : isPropertyOfficer
      ? (selectedRequest?.items ?? []).filter(
          (item) => item.unit?.code?.trim().toUpperCase() === "PROPERTY"
        )
      : isDormitoryOfficer
        ? (selectedRequest?.items ?? []).filter(
            (item) => item.unit?.code?.trim().toUpperCase() === "DORMITORY"
          )
        : isFinanceOfficer
          ? (selectedRequest?.items ?? []).filter(
              (item) => item.unit?.code?.trim().toUpperCase() === "FINANCE"
            )
          : isCollegeOfficer
            ? (selectedRequest?.items ?? []).filter(
                (item) => item.unit?.code?.trim().toUpperCase() === "COLLEGE"
              )
            : isDepartmentOfficer
              ? (selectedRequest?.items ?? []).filter(
                  (item) => item.unit?.code?.trim().toUpperCase() === "DEPARTMENT"
                )
              : (selectedRequest?.items ?? []);

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

        <p className="nav-label">{isAdmin ? "ADMIN MENU" : isRegistrar ? "REGISTRAR MENU" : isLibraryOfficer ? "LIBRARY MENU" : isPropertyOfficer ? "PROPERTY MENU" : isDormitoryOfficer ? "DORMITORY MENU" : isFinanceOfficer ? "FINANCE MENU" : isCollegeOfficer ? "COLLEGE MENU" : isDepartmentOfficer ? "DEPARTMENT MENU" : "USER MENU"}</p>

        {(isAdmin

          ? ["Overview", "All Clearances", "Clearance Configuration", "Profile"]

          : isLibraryOfficer

            ? ["Overview", "View Clearance Requests", "Clearance History", "Logout"]

            : isPropertyOfficer

              ? ["Overview", "View Clearance Requests", "Clearance History", "Logout"]

              : isDormitoryOfficer
                ? ["Overview", "View Clearance Requests", "Clearance History", "Logout"]
                : isFinanceOfficer
                  ? ["Overview", "View Clearance Requests", "Clearance History", "Logout"]
                  : isRegistrar ? ["Overview", "View Clearance Requests", "Clearance History", "Logout"] : isCollegeOfficer ? ["Overview", "View Clearance Requests", "Clearance History", "Logout"] : isDepartmentOfficer ? ["Overview", "View Clearance Requests", "Clearance History", "Logout"] : ["Overview", "My Clearance", "Apply for Clearance", "Profile"]

        ).map((item) => (
          <button
            key={item}
            className="nav-item"
            onClick={() => {
if (item === "Logout") {
  logout();
} else if (item === "View Clearance Requests") {
  if (isCollegeOfficer) {
    setCollegeView("requests");
  } else if (isDepartmentOfficer) {
    setDepartmentView("requests");
  } else if (isDormitoryOfficer) {
    setDormitoryView("requests");
  } else if (isRegistrar) {
    setRegistrarView("requests");
      } else if (isFinanceOfficer) {
        setFinanceView("requests");
      } else if (isLibraryOfficer) {
        setLibraryView("requests");
      } else if (isPropertyOfficer) {
        setPropertyView("requests");
  }

  setSelectedRequest(null);
  setDetailError("");
  setReviewError("");
  setReviewMessage("");
  document.getElementById("requests")?.scrollIntoView({ behavior: "smooth" });

} else if (item === "Clearance History") {
  if (isCollegeOfficer) {
    setCollegeView("history");
  } else if (isDepartmentOfficer) {
    setDepartmentView("history");
  } else if (isDormitoryOfficer) {
    setDormitoryView("history");
  } else if (isRegistrar) {
    setRegistrarView("history");
      } else if (isFinanceOfficer) {
        setFinanceView("history");
      } else if (isLibraryOfficer) {
        setLibraryView("history");
      } else if (isPropertyOfficer) {
        setPropertyView("history");
  }

  setSelectedRequest(null);
  setDetailError("");
  setReviewError("");
  setReviewMessage("");
  document.getElementById("requests")?.scrollIntoView({ behavior: "smooth" });} else if (item === "Apply for Clearance") {
  void openApplicationForm();
} else if (
                item === "All Clearances" ||
                item === "Library Clearance Requests" ||
                item === "Property Clearance Requests" ||
                item === "Dormitory Clearance Requests" ||
                item === "Finance Clearance Requests" ||
                item === "Department Clearance Requests" ||
                item === "College Clearance Requests" ||
                item === "My Clearance"
              ) {
                document.getElementById("requests")?.scrollIntoView({
                  behavior: "smooth",
                });
              } else if (item === "Clearance Configuration") {
                setShowConfigurationPanel(true);
                document.getElementById("clearance-configuration")?.scrollIntoView({ behavior: "smooth" });
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
              {isAdmin ? "Clearance Administration" : isLibraryOfficer ? "Library Clearance" : isPropertyOfficer ? "Property Clearance" : isDormitoryOfficer ? "Dormitory Clearance" : isFinanceOfficer ? "Finance Clearance" : isCollegeOfficer ? "College Clearance" : isDepartmentOfficer ? "Department Clearance" : "Student Clearance"}
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
              <span>{isAdmin ? "Administrator" : isLibraryOfficer ? "Library Officer" : isPropertyOfficer ? "Property Officer" : isDormitoryOfficer ? "Dormitory Officer" : isFinanceOfficer ? "Finance Officer" : isCollegeOfficer ? "College Officer" : isDepartmentOfficer ? "Department Officer" : "User Portal"}</span>
            </div>
          </div>
        </header>

        <div className="content">
          <div className={`welcome-row ${isAdmin ? "admin-welcome-row" : isLibraryOfficer ? "library-welcome-row" : isPropertyOfficer ? "property-welcome-row" : isDormitoryOfficer ? "dormitory-welcome-row" : ""}`}>
            <div>
              <p className="muted">
                {isAdmin ? "ADMINISTRATOR DASHBOARD" : isLibraryOfficer ? "LIBRARY OFFICER DASHBOARD" : isPropertyOfficer ? "PROPERTY OFFICER DASHBOARD" : isDormitoryOfficer ? "DORMITORY OFFICER DASHBOARD" : isFinanceOfficer ? "FINANCE OFFICER DASHBOARD" : isCollegeOfficer ? "COLLEGE OFFICER DASHBOARD" : isDepartmentOfficer ? "DEPARTMENT OFFICER DASHBOARD" : "USER DASHBOARD"}
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
                  : isLibraryOfficer ? "Review and process Library clearance requests." : isPropertyOfficer ? "Review and process Property clearance requests." : isDormitoryOfficer ? "Review and process Dormitory clearance requests." : isFinanceOfficer ? "Review and process Finance clearance requests." : isCollegeOfficer ? "Review and process College clearance requests." : isDepartmentOfficer ? "Review and process Department clearance requests." : "Manage your clearance application and track your progress."}
              </p>
            </div>
          </div>
{applicationMessage && (
  <section className="panel" role="status">
    <p>{applicationMessage}</p>
    <button
      className="primary-button"
      onClick={() => setApplicationMessage("")}
    >
      Dismiss
    </button>
  </section>
)}

{/* STUDENT INFORMATION AND CLEARANCE HISTORY */}
{!isAdmin && !isLibraryOfficer && !isPropertyOfficer && !isDormitoryOfficer && !isFinanceOfficer && !isDepartmentOfficer && !isCollegeOfficer && !isRegistrar && studentProfile && (
  <section className="panel" id="student-information">
    <div className="section-heading">
      <div>
        <p className="muted">STUDENT PROFILE</p>
        <h3>Student Information</h3>
        <p className="subheading">
          Your registered university information.
        </p>
      </div>
    </div>

    <div className="request-summary">
      <div>
        <span>Student name</span>
        <strong>
          {`${studentProfile.firstName} ${studentProfile.middleName ?? ""} ${studentProfile.lastName}`
            .replace(/\s+/g, " ")
            .trim()}
        </strong>
      </div>
      <div>
        <span>Student ID</span>
        <strong>{studentProfile.studentId}</strong>
      </div>
      <div>
        <span>Department</span>
        <strong>{studentProfile.department?.name ?? "Not available"}</strong>
      </div>
      <div>
        <span>Program</span>
        <strong>{studentProfile.program?.name ?? "Not available"}</strong>
      </div>
      <div>
        <span>Email</span>
        <strong>{studentProfile.email ?? user?.email ?? "Not available"}</strong>
      </div>
      <div>
        <span>Account status</span>
        <strong>{studentProfile.isActive ? "Active" : "Inactive"}</strong>
      </div>
    </div>
  </section>
)}

{!isAdmin && !isLibraryOfficer && !isPropertyOfficer && !isDormitoryOfficer && !isFinanceOfficer && !isDepartmentOfficer && !isCollegeOfficer && !isRegistrar && (
  <section className="panel" id="requests">
    <div className="section-heading">
      <div>
        <p className="muted">STUDENT RECORDS</p>
        <h3>Clearance Request History</h3>
        <p className="subheading">
          Review your previous clearance applications and their current status.
        </p>
      </div>
      <span className="status-pill">{requests.length} requests</span>
    </div>

    <div className="student-history-metrics" aria-label="Clearance request summary">
      {[
        { label: "In progress", value: requests.filter((item) => formatStatus(item.status).toLowerCase() === "in progress").length, tone: "progress" },
        { label: "Action required", value: requests.filter((item) => formatStatus(item.status).toLowerCase() === "action required").length, tone: "action" },
        { label: "Submitted", value: requests.filter((item) => formatStatus(item.status).toLowerCase() === "submitted").length, tone: "submitted" },
        { label: "Completed", value: requests.filter((item) => formatStatus(item.status).toLowerCase() === "completed").length, tone: "completed" },
      ].map((metric) => (
        <article className={`student-history-metric student-history-${metric.tone}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </div>
    {requests.length === 0 ? (
      <div className="admin-empty-state">
        <strong>No clearance request history yet</strong>
        <p>Your submitted clearance applications will appear here.</p>
        <button
          type="button"
          className="primary-button"
          onClick={() => void openApplicationForm()}
        >
          Apply for Clearance
        </button>
      </div>
    ) : (
      <div className="table-wrapper student-history-table-wrapper">
        <table className="student-history-table">
          <thead>
            <tr>
              <th>Request number</th>
              <th>Clearance type</th>
              <th>Submitted / created</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td><strong>{request.requestNumber}</strong></td>
                <td>{request.template?.name ?? "Clearance request"}</td>
                <td>
                  {new Date(
                    request.submittedAt ?? request.createdAt
                  ).toLocaleDateString()}
                </td>
                <td>
                  <span className={`status-pill student-history-status student-status-${formatStatus(request.status).toLowerCase().replace(/\s+/g, "-")}`}>
                    {formatStatus(request.status)}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="primary-button admin-view-button"
                    onClick={() => void openRequest(request.id)}
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}
{isAdmin && showConfigurationPanel && (
  <section className="panel" id="clearance-configuration">
    <div className="section-heading">
      <div>
        <h3>Clearance Configuration</h3>
        <p className="subheading">
          Configure clearance templates and their associated university workflows.
        </p>
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => setShowConfigurationPanel(false)}
      >
        Close
      </button>
    </div>
    <form className="form-grid" onSubmit={createClearanceTemplate}>
      <div>
        <label htmlFor="template-code">Template code</label>
        <input
          id="template-code"
          value={templateCode}
          onChange={(event) => setTemplateCode(event.target.value)}
          placeholder="e.g. SEMESTER-2026"
          minLength={2}
          maxLength={30}
          required
        />
      </div>

      <div>
        <label htmlFor="template-name">Template name</label>
        <input
          id="template-name"
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
          placeholder="e.g. Semester Clearance"
          minLength={2}
          maxLength={120}
          required
        />
      </div>

      <div>
        <label htmlFor="template-clearance-type">Clearance type</label>
        <select
          id="template-clearance-type"
          value={templateClearanceType}
          onChange={(event) =>
            setTemplateClearanceType(event.target.value)
          }
          required
        >
          <option value="SEMESTER">Semester Clearance</option>
          <option value="END_OF_YEAR">End of Year Clearance</option>
          <option value="GRADUATION">Graduation Clearance</option>
          <option value="OTHER">Other Clearance</option>
        </select>
      </div>

      <div>
        <label htmlFor="template-description">Description (optional)</label>
        <textarea
          id="template-description"
          value={templateDescription}
          onChange={(event) =>
            setTemplateDescription(event.target.value)
          }
          placeholder="Describe the purpose of this template."
          maxLength={500}
          rows={3}
        />
      </div>

      {templateError && (
        <p className="review-error" role="alert">
          {templateError}
        </p>
      )}

      {templateMessage && (
        <p className="review-success" role="status">
          {templateMessage}
        </p>
      )}

      <div>
        <button type="submit" disabled={templateSubmitting}>
          {templateSubmitting ? "Creating template..." : "Create template"}
        </button>
      </div>
    </form>

    <div className="section-heading">
      <div>
        <h4>Existing templates</h4>
        <p className="subheading">
          Templates are listed by clearance type and activation status.
        </p>
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => void loadAdminTemplates()}
      >
        Refresh
      </button>
    </div>

    {templates.length === 0 ? (
      <p>No templates were returned by the API.</p>
    ) : (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Clearance type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>{template.code}</td>
                <td>
                  <strong>{template.name}</strong>
                  {template.description && (
                    <p className="subheading">
                      {template.description}
                    </p>
                  )}
                </td>
                <td>
                  {{
                    SEMESTER: "Semester",
                    END_OF_YEAR: "End of Year",
                    GRADUATION: "Graduation",
                    OTHER: "Other",
                  }[template.clearanceType] ?? template.clearanceType}
                </td>
                <td>{template.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <div className="section-heading">
      <div>
        <h4>Manage template items</h4>
        <p className="subheading">
          Select a template, assign each item to an active clearance unit,
          and review its configured items.
        </p>
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => void loadClearanceUnits()}
      >
        Refresh units
      </button>
    </div>

    <div className="form-grid">
      <div>
        <label htmlFor="item-template">Clearance template</label>
        <select
          id="item-template"
          value={itemTemplateId}
          onChange={(event) => {
            const templateId = event.target.value;
            setItemTemplateId(templateId);
            setTemplateItems([]);
            setItemError("");
            setItemMessage("");
            void loadTemplateItems(templateId);
          }}
        >
          <option value="">Select a template</option>
          {templates.filter((template) => template.isActive).map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.code})
            </option>
          ))}
        </select>
      </div>
    </div>

    <form className="form-grid" onSubmit={createTemplateItem}>
      <div>
        <label htmlFor="item-name">Item name</label>
        <input
          id="item-name"
          value={itemName}
          onChange={(event) => setItemName(event.target.value)}
          placeholder="e.g. Return borrowed library materials"
          minLength={2}
          maxLength={120}
          required
        />
      </div>

      <div>
        <label htmlFor="item-unit">Responsible clearance unit</label>
        <select
          id="item-unit"
          value={itemUnitId}
          onChange={(event) => setItemUnitId(event.target.value)}
          required
        >
          <option value="">Select a unit</option>
          {clearanceUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({unit.code})
            </option>
          ))}
        </select>
        {clearanceUnits.length === 0 && (
          <p className="subheading">
            No active units are loaded. Use Refresh units and check the API
            if the list remains empty.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="item-description">Description (optional)</label>
        <textarea
          id="item-description"
          value={itemDescription}
          onChange={(event) => setItemDescription(event.target.value)}
          placeholder="Describe what this unit must verify."
          maxLength={500}
          rows={3}
        />
      </div>

      <div>
        <label htmlFor="item-order">Display order</label>
        <input
          id="item-order"
          type="number"
          min={0}
          step={1}
          value={itemOrder}
          onChange={(event) => setItemOrder(event.target.value)}
          required
        />
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={itemIsRequired}
            onChange={(event) => setItemIsRequired(event.target.checked)}
          />
          Required clearance item
        </label>
      </div>

      {itemError && (
        <p className="review-error" role="alert">{itemError}</p>
      )}

      {itemMessage && (
        <p className="review-success" role="status">{itemMessage}</p>
      )}

      <div>
        <button
          type="submit"
          disabled={
            itemSubmitting ||
            !itemTemplateId ||
            clearanceUnits.length === 0
          }
        >
          {itemSubmitting ? "Adding item..." : "Add template item"}
        </button>
      </div>
    </form>

    <div className="section-heading">
      <div>
        <h4>Configured items</h4>
        <p className="subheading">
          Items currently associated with the selected template.
        </p>
      </div>
      <button
        type="button"
        className="text-button"
        disabled={!itemTemplateId || itemsLoading}
        onClick={() => void loadTemplateItems(itemTemplateId)}
      >
        Refresh items
      </button>
    </div>

    {!itemTemplateId ? (
      <p>Select a template to view its items.</p>
    ) : itemsLoading ? (
      <p>Loading template items...</p>
    ) : templateItems.length === 0 ? (
      <p>No items are configured for this template yet.</p>
    ) : (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Item</th>
              <th>Responsible unit</th>
              <th>Requirement</th>
            </tr>
          </thead>
          <tbody>
            {[...templateItems]
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <tr key={item.id}>
                  <td>{item.order}</td>
                  <td>
                    <strong>{item.name}</strong>
                    {item.description && (
                      <p className="subheading">{item.description}</p>
                    )}
                  </td>
                  <td>
                    {item.unit?.name ?? clearanceUnits.find(
                      (unit) => unit.id === item.unitId
                    )?.name ?? "Unit unavailable"}
                    {item.unit?.code && (
                      <p className="subheading">{item.unit.code}</p>
                    )}
                  </td>
                  <td>{item.isRequired ? "Required" : "Optional"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}
{showApplicationForm && !isDepartmentOfficer && !isCollegeOfficer && (
  <section className="panel" id="application">
    <div className="section-heading">
      <div>
        <h3>Apply for Clearance</h3>
        <p>Review your profile and choose your clearance application.</p>
      </div>

      <button
        type="button"
        className="text-button"
        onClick={() => setShowApplicationForm(false)}
      >
        Cancel
      </button>
    </div>

    {applicationLoading && <p>Loading your profile and available applications...</p>}

    {applicationError && (
      <p className="review-error" role="alert">
        {applicationError}
      </p>
    )}

    {!applicationLoading && studentProfile && (
      <>
        <div className="request-summary">
          <div>
            <span>Student name</span>
            <strong>
              {`${studentProfile.firstName} ${studentProfile.middleName ?? ""} ${studentProfile.lastName}`
                .replace(/\s+/g, " ")
                .trim()}
            </strong>
          </div>

          <div>
            <span>Student ID</span>
            <strong>{studentProfile.studentId}</strong>
          </div>

          <div>
            <span>Department</span>
            <strong>{studentProfile.department?.name ?? "Not available"}</strong>
          </div>

          <div>
            <span>Program</span>
            <strong>{studentProfile.program?.name ?? "Not available"}</strong>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitApplication();
          }}
        >
          <div className="form-group">
            <label htmlFor="clearance-type">Clearance type</label>
            <select
              id="clearance-type"
              value={clearanceType}
              onChange={(event) => {
                const nextClearanceType = event.target.value;
                setClearanceType(nextClearanceType);
                setOtherReason("");
                setApplicationError("");

                const matchingTemplate = templates.find(
                  (template) =>
                    template.isActive &&
                    template.clearanceType === nextClearanceType
                );

                setSelectedTemplateId(matchingTemplate?.id ?? "");

                const matchingWorkflow = workflows.find(
                  (workflow) =>
                    workflow.isActive &&
                    workflow.templateId === matchingTemplate?.id
                );

                setSelectedWorkflowId(matchingWorkflow?.id ?? "");

                if (!matchingTemplate) {
                  setApplicationError(
                    `No active template is configured for ${nextClearanceType} clearance. Please contact the administrator.`
                  );
                } else if (!matchingWorkflow) {
                  setApplicationError(
                    `No active workflow is configured for ${nextClearanceType} clearance. Please contact the administrator.`
                  );
                }
              }}
              required
            >
              <option value="SEMESTER">Semester Clearance</option>
              <option value="END_OF_YEAR">End of Year Clearance</option>
              <option value="GRADUATION">Graduation Clearance</option>
              <option value="OTHER">Other</option>
            </select>
          </div>


          {clearanceType === "OTHER" && (
            <div className="form-group">
              <label htmlFor="other-reason">Reason for clearance</label>
              <textarea
                id="other-reason"
                value={otherReason}
                onChange={(event) => setOtherReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Explain why you need clearance"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Configured clearance template</label>
            {templates.find(
              (template) =>
                template.id === selectedTemplateId &&
                template.isActive &&
                template.clearanceType === clearanceType
            ) ? (
              <>
                <p className="panel-description">
                  {templates.find(
                    (template) =>
                      template.id === selectedTemplateId &&
                      template.isActive &&
                      template.clearanceType === clearanceType
                  )?.name}
                </p>
                {templates.find(
                  (template) =>
                    template.id === selectedTemplateId &&
                    template.isActive &&
                    template.clearanceType === clearanceType
                )?.description && (
                  <p className="panel-description">
                    {templates.find(
                      (template) =>
                        template.id === selectedTemplateId &&
                        template.isActive &&
                        template.clearanceType === clearanceType
                    )?.description}
                  </p>
                )}
              </>
            ) : (
              <p className="panel-description">
                No active template is configured for this clearance type. Please contact the administrator.
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Configured workflow</label>
            {workflows.find(
              (workflow) =>
                workflow.id === selectedWorkflowId &&
                workflow.isActive &&
                workflow.templateId === selectedTemplateId
            ) ? (
              <p className="panel-description">
                {workflows.find(
                  (workflow) =>
                    workflow.id === selectedWorkflowId &&
                    workflow.isActive &&
                    workflow.templateId === selectedTemplateId
                )?.name}
              </p>
            ) : (
              <p className="panel-description">
                No active workflow is configured for this clearance type.
              </p>
            )}
          </div>

          <p className="panel-description">
            Your application will be routed through the configured clearance
            process. You can track its progress from your dashboard.
          </p>

          <button
            type="submit"
            className="primary-button"
            disabled={
              applicationSubmitting ||
              !selectedTemplateId ||
              !selectedWorkflowId
            }
          >
            {applicationSubmitting
              ? "Submitting application..."
              : "Submit clearance application"}
          </button>
        </form>
      </>
    )}
  </section>
)}
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
{(isAdmin || isLibraryOfficer || isPropertyOfficer || isDormitoryOfficer || isFinanceOfficer || isDepartmentOfficer || isCollegeOfficer || isRegistrar) && (
  <section className="panel admin-requests-panel" id="requests">
    <div className="section-heading">
      <div>
        <p className="muted">{isLibraryOfficer ? "LIBRARY REVIEW" : isPropertyOfficer ? "PROPERTY REVIEW" : isDormitoryOfficer ? "DORMITORY REVIEW" : isFinanceOfficer ? "FINANCE REVIEW" : isCollegeOfficer ? "COLLEGE REVIEW" : isDepartmentOfficer ? "DEPARTMENT REVIEW" : "ADMINISTRATION"}</p>
        <h3>{isLibraryOfficer && libraryView === "history" ? "Library Clearance History" : isLibraryOfficer ? "Library Clearance Requests" : isPropertyOfficer && propertyView === "history" ? "Property Clearance History" : isPropertyOfficer ? "Property Clearance Requests" : isDormitoryOfficer && dormitoryView === "history" ? "Dormitory Clearance History" : isDormitoryOfficer ? "Dormitory Clearance Requests" : isFinanceOfficer && financeView === "history" ? "Finance Clearance History" : isFinanceOfficer ? "Finance Clearance Requests" : isCollegeOfficer ? "College Clearance Requests" : isDepartmentOfficer ? "Department Clearance Requests" : "All Clearances"}</h3>
        <p className="subheading">
          {isLibraryOfficer ? "Open student requests to review Library clearance items." : isPropertyOfficer ? "Open student requests to review Property clearance items." : isDormitoryOfficer ? "Open student requests to review Dormitory clearance items." : isFinanceOfficer ? (financeView === "history" ? "Review previously processed Finance clearance items." : "Review pending Finance clearance items.") : isCollegeOfficer ? "Review College clearance requests and view previously processed items." : isDepartmentOfficer ? "Review Department clearance requests and view previously processed items." : "Monitor student clearance applications and open individual requests for review."}
        </p>
      </div>
    </div>

    <div className="admin-metric-grid">
      <article className="admin-metric-card">
        <span className="admin-metric-label">Total requests</span>
        <strong className="admin-metric-value">{counts.total}</strong>
        <span className="admin-metric-note">All loaded applications</span>
      </article>

      <article className="admin-metric-card">
        <span className="admin-metric-label">Pending</span>
        <strong className="admin-metric-value">{counts.pending}</strong>
        <span className="admin-metric-note">Awaiting completion</span>
      </article>

      <article className="admin-metric-card">
        <span className="admin-metric-label">Action required</span>
        <strong className="admin-metric-value">{counts.actionRequired}</strong>
        <span className="admin-metric-note">Require attention</span>
      </article>

      <article className="admin-metric-card">
        <span className="admin-metric-label">Completed</span>
        <strong className="admin-metric-value">{counts.completed}</strong>
        <span className="admin-metric-note">Successfully completed</span>
      </article>
    </div>

    <div className="admin-requests-heading">
      <div>
        <h4>{isRegistrar && registrarView === "history" ? "Registrar Clearance History" : isRegistrar ? "Registrar Clearance Requests" : isCollegeOfficer && collegeView === "history" ? "College Clearance History" : isCollegeOfficer ? "College Clearance Requests" : isDepartmentOfficer && departmentView === "history" ? "Department Clearance History" : isDepartmentOfficer ? "Department Clearance Requests" : isDormitoryOfficer && dormitoryView === "history" ? "Dormitory Clearance History" : isDormitoryOfficer ? "Dormitory Clearance Requests" : isFinanceOfficer && financeView === "history" ? "Finance Clearance History" : isFinanceOfficer ? "Finance Clearance Requests" : isLibraryOfficer && libraryView === "history" ? "Library Clearance History" : isLibraryOfficer ? "Library Clearance Requests" : isPropertyOfficer && propertyView === "history" ? "Property Clearance History" : isPropertyOfficer ? "Property Clearance Requests" : "Clearance request register"}</h4>
        <p className="subheading">
          Select a request to inspect its clearance items and available review actions.
        </p>
      </div>
      <span className="status-pill">{visibleRequests.length} requests</span>
    </div>

    {visibleRequests.length === 0 ? (
      <div className="admin-empty-state">
        <strong>No clearance requests available</strong>
        <p>Requests will appear here when they are returned by the system.</p>
      </div>
    ) : (
      <div className="table-wrapper admin-request-table-wrapper">
        <table className="admin-request-table">
          <thead>
            <tr>
              <th>Request number</th>
              <th>Student</th>
              <th>Clearance type</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.map((request) => (
              <tr key={request.id}>
                <td>
                  <strong>{request.requestNumber}</strong>
                </td>
                <td>
                  <strong>
                    {`${request.student?.firstName ?? ""} ${request.student?.lastName ?? ""}`.trim() ||
                      "Student information unavailable"}
                  </strong>
                  <span className="admin-request-secondary">
                    {request.student?.studentId ?? "No student ID"}
                  </span>
                </td>
                <td>{request.template?.name ?? "Clearance request"}</td>
                <td>
                  {new Date(
                    request.submittedAt ?? request.createdAt
                  ).toLocaleDateString()}
                </td>
                <td>
                  <span className="status-pill">
                    {formatStatus(
  isDepartmentOfficer
    ? (request.items ?? []).find(
        (item) => item.unit?.code?.trim().toUpperCase() === "DEPARTMENT"
      )?.status ?? request.status
    : isDormitoryOfficer
      ? (request.items ?? []).find(
          (item) => item.unit?.code?.trim().toUpperCase() === "DORMITORY"
        )?.status ?? request.status
      : request.status
)}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="primary-button admin-view-button"
                    onClick={() => void openRequest(request.id)}
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}
{!isAdmin && !isLibraryOfficer && !isPropertyOfficer && !isDormitoryOfficer && !isFinanceOfficer && !isDepartmentOfficer && !isCollegeOfficer && !isRegistrar && dashboardProgressRequest && (
  <section className="panel" id="clearance-progress">
    <div className="section-heading">
      <div>
        <h3>Clearance Progress</h3>
        <p>
          Track the approval status of each office for your
          latest active clearance request.
        </p>
      </div>
      <span className="status-pill">
        {formatStatus(dashboardProgressRequest.status)}
      </span>
    </div>

<div className="request-summary">
  <div>
    <span>Request number</span>
    <strong>{dashboardProgressRequest.requestNumber}</strong>
  </div>

  <div>
    <span>Clearance type</span>
    <strong>
      {dashboardProgressRequest.template?.name ?? "Clearance request"}
    </strong>
  </div>

  <div>
    <span>Submitted date</span>
    <strong>
      {dashboardProgressRequest.submittedAt
        ? new Date(
            dashboardProgressRequest.submittedAt,
          ).toLocaleDateString()
        : new Date(
            dashboardProgressRequest.createdAt,
          ).toLocaleDateString()}
    </strong>
  </div>

  <div>
    <span>Completed date</span>
    <strong>
      {dashboardProgressRequest.completedAt
        ? new Date(
            dashboardProgressRequest.completedAt,
          ).toLocaleDateString()
        : "Not completed"}
    </strong>
  </div>
</div>

    <div className="progress-table-wrapper">
      <table className="progress-table">
        <thead>
          <tr>
            <th>Office Name</th>
            <th>Status</th>
            <th>View</th>
          </tr>
        </thead>

        <tbody>
          {getClearanceProgress(dashboardProgressRequest).map(
            (stage) => {
              const officeItem = getClearanceItemForOffice(
                dashboardProgressRequest,
                stage.name,
              );

              const isExpanded = expandedOffice === stage.name;

              return (
                <tr key={stage.name}>
                  <td>
                    <strong>{stage.name}</strong>

                    {isExpanded && (
                      <div className="office-details">
                        <p>
                          <strong>Office:</strong>{" "}
                          {officeItem?.unit?.name ?? stage.name}
                        </p>

                        {officeItem?.templateItem?.name && (
                          <p>
                            <strong>Clearance item:</strong>{" "}
                            {officeItem.templateItem.name}
                          </p>
                        )}

                        {officeItem?.templateItem?.description && (
                          <p>
                            {officeItem.templateItem.description}
                          </p>
                        )}

                        {officeItem?.comment && (
                          <p>
                            <strong>Review comment:</strong>{" "}
                            {officeItem.comment}
                          </p>
                        )}

                        {officeItem?.correctionComment && (
                          <p>
                            <strong>Correction comment:</strong>{" "}
                            {officeItem.correctionComment}
                          </p>
                        )}

                        {officeItem?.reviewedAt && (
                          <p>
                            <strong>Reviewed:</strong>{" "}
                            {new Date(
                              officeItem.reviewedAt,
                            ).toLocaleString()}
                          </p>
                        )}

                        {stage.name === "Registrar" && (
                          <p>
                            <strong>Request status:</strong>{" "}
                            {formatStatus(
                              dashboardProgressRequest.status,
                            )}
                            {dashboardProgressRequest.completedAt && (
                              <>
                                {" "}
                                — Completed{" "}
                                {new Date(
                                  dashboardProgressRequest.completedAt,
                                ).toLocaleString()}
                              </>
                            )}
                          </p>
                        )}

                        {!officeItem &&
                          stage.name !== "Registrar" && (
                            <p>
                              No individual clearance item details
                              are available for this office.
                            </p>
                          )}
                      </div>
                    )}
                  </td>

                  <td>
                    <span
                      className={`progress-status ${stage.status
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                    >
                      {stage.status}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        setExpandedOffice(
                          isExpanded ? null : stage.name,
                        )
                      }
                    >
                      {isExpanded ? "Hide Details" : "Details"}
                    </button>
                  </td>
                </tr>
              );
            },
          )}
        </tbody>
      </table>
    </div>
  </section>
)}
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
                      {isFinanceOfficer && selectedRequest && (
                        <section className="office-progress-panel">
                          <div className="section-heading">
                            <div>
                              <h3>Finance Approval Prerequisites</h3>
                              <p>
                                Review clearance progress across all seven offices before
                                reviewing Finance clearance.
                              </p>
                            </div>
                          </div>

                          <div className="progress-table-wrapper">
                            <table className="progress-table">
                              <thead>
                                <tr>
                                  <th>Office Name</th>
                                  <th>Status</th>
                                  <th>View</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getClearanceProgress(selectedRequest)
                                  .filter((stage) =>
                                    ["Library", "Property", "Dormitory", "Finance", "Department", "College", "Registrar"]
                                      .includes(stage.name)
                                  )
                                  .map((stage) => {
                                    const officeItem =
                                      getClearanceItemForOffice(
                                        selectedRequest,
                                        stage.name
                                      );
                                    const detailKey =
                                      `Finance:${stage.name}`;
                                    const isExpanded =
                                      expandedOffice === detailKey;

                                    return (
                                      <>
                                        <tr>
                                          <td>
                                            <strong>{stage.name}</strong>
                                          </td>
                                          <td>
                                            <span
                                              className={`progress-status ${stage.status
                                                .toLowerCase()
                                                .replaceAll(" ", "-")}`}
                                            >
                                              {stage.status}
                                            </span>
                                          </td>
                                          <td>
                                            <button
                                              type="button"
                                              className="secondary-button"
                                              onClick={() =>
                                                setExpandedOffice(
                                                  isExpanded ? null : detailKey
                                                )
                                              }
                                            >
                                              {isExpanded
                                                ? "Hide Details"
                                                : "Details"}
                                            </button>
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr>
                                            <td colSpan={3}>
                                              <div className="office-details">
                                                <p>
                                                  <strong>Office:</strong>{" "}
                                                  {officeItem?.unit?.name ??
                                                    stage.name}
                                                </p>
                                                <p>
                                                  <strong>Item status:</strong>{" "}
                                                  {officeItem
                                                    ? formatStatus(officeItem.status)
                                                    : "No item configured"}
                                                </p>
                                                {officeItem?.templateItem?.name && (
                                                  <p>
                                                    <strong>Clearance item:</strong>{" "}
                                                    {officeItem.templateItem.name}
                                                  </p>
                                                )}
                                                {officeItem?.templateItem?.description && (
                                                  <p>
                                                    {officeItem.templateItem.description}
                                                  </p>
                                                )}
                                                {officeItem?.comment && (
                                                  <p>
                                                    <strong>Review comment:</strong>{" "}
                                                    {officeItem.comment}
                                                  </p>
                                                )}
                                                {officeItem?.correctionComment && (
                                                  <p>
                                                    <strong>Correction comment:</strong>{" "}
                                                    {officeItem.correctionComment}
                                                  </p>
                                                )}
                                                {officeItem?.reviewedAt && (
                                                  <p>
                                                    <strong>Reviewed:</strong>{" "}
                                                    {new Date(
                                                      officeItem.reviewedAt
                                                    ).toLocaleString()}
                                                  </p>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {isDepartmentOfficer && selectedRequest && (
                        <section className="office-progress-panel">
                          <div className="section-heading">
                            <div>
                              <h3>{departmentView === "history" ? "Department Clearance Progress" : "Department Approval Prerequisites"}</h3>
                              <p>
                                Verify all previous offices before
                                reviewing Department clearance.
                              </p>
                            </div>
                          </div>

                          <div className="progress-table-wrapper">
                            <table className="progress-table">
                              <thead>
                                <tr>
                                  <th>Office Name</th>
                                  <th>Status</th>
                                  <th>View</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getClearanceProgress(selectedRequest)
                                  .filter((stage) =>
                                    (
                                      departmentView === "history"
                                        ? ["Library", "Property", "Dormitory", "Finance", "Department", "College", "Registrar"]
                                        : ["Library", "Property", "Dormitory", "Finance", "Department"]
                                    ).includes(stage.name)
                                  )
                                  .map((stage) => {
                                    const officeItem =
                                      getClearanceItemForOffice(
                                        selectedRequest,
                                        stage.name
                                      );
                                    const detailKey =
                                      `Department:${stage.name}`;
                                    const isExpanded =
                                      expandedOffice === detailKey;

                                    return (
                                      <>
                                        <tr>
                                          <td>
                                            <strong>{stage.name}</strong>
                                          </td>
                                          <td>
                                            <span
                                              className={`progress-status ${stage.status
                                                .toLowerCase()
                                                .replaceAll(" ", "-")}`}
                                            >
                                              {stage.status}
                                            </span>
                                          </td>
                                          <td>
                                            <button
                                              type="button"
                                              className="secondary-button"
                                              onClick={() =>
                                                setExpandedOffice(
                                                  isExpanded ? null : detailKey
                                                )
                                              }
                                            >
                                              {isExpanded
                                                ? "Hide Details"
                                                : "Details"}
                                            </button>
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr>
                                            <td colSpan={3}>
                                              <div className="office-details">
                                                <p>
                                                  <strong>Office:</strong>{" "}
                                                  {officeItem?.unit?.name ??
                                                    stage.name}
                                                </p>
                                                <p>
                                                  <strong>Item status:</strong>{" "}
                                                  {officeItem
                                                    ? formatStatus(officeItem.status)
                                                    : "No item configured"}
                                                </p>
                                                {officeItem?.templateItem?.name && (
                                                  <p>
                                                    <strong>Clearance item:</strong>{" "}
                                                    {officeItem.templateItem.name}
                                                  </p>
                                                )}
                                                {officeItem?.templateItem?.description && (
                                                  <p>
                                                    {officeItem.templateItem.description}
                                                  </p>
                                                )}
                                                {officeItem?.comment && (
                                                  <p>
                                                    <strong>Review comment:</strong>{" "}
                                                    {officeItem.comment}
                                                  </p>
                                                )}
                                                {officeItem?.correctionComment && (
                                                  <p>
                                                    <strong>Correction comment:</strong>{" "}
                                                    {officeItem.correctionComment}
                                                  </p>
                                                )}
                                                {officeItem?.reviewedAt && (
                                                  <p>
                                                    <strong>Reviewed:</strong>{" "}
                                                    {new Date(
                                                      officeItem.reviewedAt
                                                    ).toLocaleString()}
                                                  </p>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {(isCollegeOfficer || (isRegistrar && selectedRequest.status === "COMPLETED")) && selectedRequest && (
                        <section className="office-progress-panel">
                          <div className="section-heading">
                            <div>
                              <h3>{isRegistrar ? "Clearance Progress" : "College Approval Prerequisites"}</h3>
                              <p>{isRegistrar ? "Track the approval status of each office for this completed clearance request." : "Verify all previous offices before reviewing College clearance."}</p>
                            </div>
                          </div>

                          <div className="progress-table-wrapper">
                            <table className="progress-table">
                              <thead>
                                <tr>
                                  <th>Office Name</th>
                                  <th>Status</th>
                                  <th>View</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getClearanceProgress(selectedRequest)
                                  .filter((stage) =>
                                    ["Library", "Property", "Dormitory", "Finance", "Department", "College", "Registrar"]
                                      .includes(stage.name)
                                  )
                                  .map((stage) => {
                                    const officeItem =
                                      getClearanceItemForOffice(
                                        selectedRequest,
                                        stage.name
                                      );
                                    const detailKey =
                                      `College:${stage.name}`;
                                    const isExpanded =
                                      expandedOffice === detailKey;

                                    return (
                                      <>
                                        <tr>
                                          <td>
                                            <strong>{stage.name}</strong>
                                          </td>
                                          <td>
                                            <span
                                              className={`progress-status ${stage.status
                                                .toLowerCase()
                                                .replaceAll(" ", "-")}`}
                                            >
                                              {stage.status}
                                            </span>
                                          </td>
                                          <td>
                                            <button
                                              type="button"
                                              className="secondary-button"
                                              onClick={() =>
                                                setExpandedOffice(
                                                  isExpanded ? null : detailKey
                                                )
                                              }
                                            >
                                              {isExpanded
                                                ? "Hide Details"
                                                : "Details"}
                                            </button>
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr>
                                            <td colSpan={3}>
                                              <div className="office-details">
                                                <p>
                                                  <strong>Office:</strong>{" "}
                                                  {officeItem?.unit?.name ??
                                                    stage.name}
                                                </p>
                                                <p>
                                                  <strong>Item status:</strong>{" "}
                                                  {officeItem
                                                    ? formatStatus(officeItem.status)
                                                    : "No item configured"}
                                                </p>
                                                {officeItem?.templateItem?.name && (
                                                  <p>
                                                    <strong>Clearance item:</strong>{" "}
                                                    {officeItem.templateItem.name}
                                                  </p>
                                                )}
                                                {officeItem?.templateItem?.description && (
                                                  <p>
                                                    {officeItem.templateItem.description}
                                                  </p>
                                                )}
                                                {officeItem?.comment && (
                                                  <p>
                                                    <strong>Review comment:</strong>{" "}
                                                    {officeItem.comment}
                                                  </p>
                                                )}
                                                {officeItem?.correctionComment && (
                                                  <p>
                                                    <strong>Correction comment:</strong>{" "}
                                                    {officeItem.correctionComment}
                                                  </p>
                                                )}
                                                {officeItem?.reviewedAt && (
                                                  <p>
                                                    <strong>Reviewed:</strong>{" "}
                                                    {new Date(
                                                      officeItem.reviewedAt
                                                    ).toLocaleString()}
                                                  </p>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {/* EPSU LIBRARY PROPERTY DORMITORY HISTORY PROGRESS */}
                      {(
                        (isLibraryOfficer && libraryView === "history") ||
                        (isPropertyOfficer && propertyView === "history") ||
                        (isDormitoryOfficer && dormitoryView === "history")
                      ) && selectedRequest && (
                        <section className="office-progress-panel">
                          <div className="section-heading">
                            <div>
                              <h3>Clearance Progress</h3>
                              <p>
                                Inspect the approval status of all seven offices
                                and review their individual clearance items.
                              </p>
                            </div>
                          </div>

                          <div className="progress-table-wrapper">
                            <table className="progress-table">
                              <thead>
                                <tr>
                                  <th>Office Name</th>
                                  <th>Status</th>
                                  <th>View</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getClearanceProgress(selectedRequest)
                                  .filter((stage) =>
                                    [
                                      "Library",
                                      "Property",
                                      "Dormitory",
                                      "Finance",
                                      "Department",
                                      "College",
                                      "Registrar",
                                    ].includes(stage.name)
                                  )
                                  .map((stage) => {
                                    const officeItem =
                                      getClearanceItemForOffice(
                                        selectedRequest,
                                        stage.name
                                      );
                                    const officerKey = isLibraryOfficer
                                      ? "Library"
                                      : isPropertyOfficer
                                        ? "Property"
                                        : "Dormitory";
                                    const detailKey =
                                      `${officerKey}:${stage.name}`;
                                    const isExpanded =
                                      expandedOffice === detailKey;

                                    return (
                                      <>
                                        <tr>
                                          <td>
                                            <strong>{stage.name}</strong>
                                          </td>
                                          <td>
                                            <span
                                              className={`progress-status ${stage.status
                                                .toLowerCase()
                                                .replaceAll(" ", "-")}`}
                                            >
                                              {stage.status}
                                            </span>
                                          </td>
                                          <td>
                                            <button
                                              type="button"
                                              className="secondary-button"
                                              onClick={() =>
                                                setExpandedOffice(
                                                  isExpanded ? null : detailKey
                                                )
                                              }
                                            >
                                              {isExpanded
                                                ? "Hide Details"
                                                : "Details"}
                                            </button>
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr>
                                            <td colSpan={3}>
                                              <div className="office-details">
                                                <p>
                                                  <strong>Office:</strong>{" "}
                                                  {officeItem?.unit?.name ??
                                                    stage.name}
                                                </p>
                                                <p>
                                                  <strong>Item status:</strong>{" "}
                                                  {officeItem
                                                    ? formatStatus(officeItem.status)
                                                    : "No item configured"}
                                                </p>
                                                {officeItem?.templateItem?.name && (
                                                  <p>
                                                    <strong>Clearance item:</strong>{" "}
                                                    {officeItem.templateItem.name}
                                                  </p>
                                                )}
                                                {officeItem?.templateItem?.description && (
                                                  <p>
                                                    {officeItem.templateItem.description}
                                                  </p>
                                                )}
                                                {officeItem?.comment && (
                                                  <p>
                                                    <strong>Review comment:</strong>{" "}
                                                    {officeItem.comment}
                                                  </p>
                                                )}
                                                {officeItem?.correctionComment && (
                                                  <p>
                                                    <strong>Correction comment:</strong>{" "}
                                                    {officeItem.correctionComment}
                                                  </p>
                                                )}
                                                {officeItem?.reviewedAt && (
                                                  <p>
                                                    <strong>Reviewed:</strong>{" "}
                                                    {new Date(
                                                      officeItem.reviewedAt
                                                    ).toLocaleString()}
                                                  </p>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {!((isRegistrar || isCollegeOfficer) && selectedRequest.status === "COMPLETED") && !(isDepartmentOfficer && departmentView === "history") && !(isFinanceOfficer && financeView === "history") && !(isLibraryOfficer && libraryView === "history") && !(isPropertyOfficer && propertyView === "history") && !(isDormitoryOfficer && dormitoryView === "history") && (
                        <>
                      <div className="section-heading item-heading">
                        <div>
                          <h3>Clearance items</h3>
                          <p>
                            Review each item according to the responsible unit.
                          </p>
                        </div>
                        <span className="status-pill">
                          {selectedItems.length} items
                        </span>
                      </div>

                      {!selectedItems.length ? (
                        <p className="panel-description">
                          No clearance items are associated with this request.
                        </p>
                      ) : (
                        <div className="review-item-list">
                          {selectedItems.map((item) => {
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

                        </>
                      )}
                      {isRegistrar && selectedRequest && selectedRequest.status !== "COMPLETED" && (
                        <div className="review-actions">
                          <h4>Final Registrar Approval</h4>
                          <p className="subheading">
                            All required clearance items must be approved before the request can be finalized.
                          </p>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={
                              reviewingItemId === "registrar-final-approval" ||
                              !["SUBMITTED", "IN_PROGRESS"].includes(selectedRequest.status) ||
                              (selectedRequest.items ?? []).some(
                                (item) =>
                                  item.templateItem?.isRequired &&
                                  item.status !== "APPROVED"
                              )
                            }
                            onClick={() => void finalizeRegistrarApproval()}
                          >
                            {reviewingItemId === "registrar-final-approval"
                              ? "Finalizing clearance..."
                              : "Approve Final Clearance"}
                          </button>
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
            <span>{String.fromCharCode(169)} 2026 Ethiopian Public Service University</span>
            <span>Student Clearance Management System</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
