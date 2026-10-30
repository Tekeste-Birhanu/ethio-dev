import { useCallback, useEffect, useRef, useState } from "react";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import { emptyOpportunityForm, emptyProfileFields } from "./constants.js";
import { AppSidebar } from "./components/layout.jsx";
import { OptionalProfileFields } from "./components/profiles.jsx";
import {
  CommentsDialog,
  OpportunityComposer,
} from "./components/opportunities.jsx";
import {
  Button,
  ModalCloseButton,
  ModalFooter,
  ModalHeader,
} from "./components/ui.jsx";

const registrationFields = [
  {
    name: "name",
    label: "Full name",
    type: "text",
    autoComplete: "name",
    maxLength: 100,
  },
  {
    name: "username",
    label: "Username",
    type: "text",
    autoComplete: "username",
    maxLength: 30,
    pattern: "[A-Za-z0-9_]{3,30}",
    title: "Use 3-30 letters, numbers, or underscores.",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
    maxLength: 254,
  },
];

function readDiscoverUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    tab: params.get("tab") === "developers" ? "developers" : "opportunities",
    query: "",
  };
}

function readAppRoute() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const chatConversationId = new URLSearchParams(window.location.search).get("conversation") ?? "";
  const profileMatch = pathname.match(/^\/profile\/([^/]+)$/);
  const opportunityMatch = pathname.match(/^\/opportunities\/([^/]+)$/);

  if (pathname === "/profile") {
    return { page: "profile", publicUsername: "", sharedOpportunityId: "" };
  }

  if (pathname === "/chat") {
    return { page: "chat", publicUsername: "", sharedOpportunityId: "", chatConversationId };
  }

  if (profileMatch) {
    try {
      return {
        page: "public-profile",
        publicUsername: decodeURIComponent(profileMatch[1]),
        sharedOpportunityId: "",
      };
    } catch {
      return { page: "discover", publicUsername: "", sharedOpportunityId: "" };
    }
  }

  if (opportunityMatch) {
    try {
      return {
        page: "discover",
        publicUsername: "",
        sharedOpportunityId: decodeURIComponent(opportunityMatch[1]),
      };
    } catch {
      return { page: "discover", publicUsername: "", sharedOpportunityId: "" };
    }
  }

  return { page: "discover", publicUsername: "", sharedOpportunityId: "" };
}

function writeDiscoverUrlState(tab, historyMethod = "replaceState", pathname) {
  const url = new URL(window.location.href);
  if (pathname) url.pathname = pathname;
  if (tab === "developers") url.searchParams.set("tab", "developers");
  else url.searchParams.delete("tab");
  url.searchParams.delete("q");

  window.history[historyMethod](
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function getDiscoverRequestKey(query, filters) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filters.skill.trim()) params.set("skill", filters.skill.trim());
  if (filters.city.trim()) params.set("city", filters.city.trim());
  if (filters.experience) params.set("experience", filters.experience);
  return params.toString();
}

function getDiscoverRequestParams(query, filters, cursor) {
  const params = new URLSearchParams(getDiscoverRequestKey(query, filters));
  if (cursor) params.set("cursor", cursor);
  return params;
}

const emptyDiscoverFilters = {
  skill: "",
  city: "",
  experience: "",
};

function App() {
  const [initialRoute] = useState(readAppRoute);
  const [initialDiscoverUrl] = useState(readDiscoverUrlState);
  const [publicUsername, setPublicUsername] = useState(
    initialRoute.publicUsername,
  );
  const [sharedOpportunityId, setSharedOpportunityId] = useState(
    initialRoute.sharedOpportunityId,
  );
  const [page, setPage] = useState(initialRoute.page);
  const [mode, setMode] = useState("register");
  const [registration, setRegistration] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });
  const [credentials, setCredentials] = useState({
    identifier: "",
    password: "",
  });
  const [googleUsername, setGoogleUsername] = useState("");
  const [profileDetails, setProfileDetails] = useState(emptyProfileFields);
  const [profileData, setProfileData] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesLoadedQuery, setOpportunitiesLoadedQuery] =
    useState(null);
  const [opportunitiesError, setOpportunitiesError] = useState("");
  const [opportunitiesRetry, setOpportunitiesRetry] = useState(0);
  const [nextOpportunityCursor, setNextOpportunityCursor] = useState(null);
  const [hasMoreOpportunities, setHasMoreOpportunities] = useState(false);
  const [isLoadingMoreOpportunities, setIsLoadingMoreOpportunities] =
    useState(false);
  const [loadMoreOpportunitiesError, setLoadMoreOpportunitiesError] =
    useState("");
  const [discoverTab, setDiscoverTab] = useState(initialDiscoverUrl.tab);
  const [discoverFilters, setDiscoverFilters] = useState(emptyDiscoverFilters);
  const [areDiscoverFiltersOpen, setAreDiscoverFiltersOpen] = useState(false);
  const [debouncedDiscoverFilters, setDebouncedDiscoverFilters] =
    useState(emptyDiscoverFilters);
  const [discoverQuery, setDiscoverQuery] = useState(initialDiscoverUrl.query);
  const [debouncedDiscoverQuery, setDebouncedDiscoverQuery] = useState(
    initialDiscoverUrl.query,
  );
  const latestDiscoverQuery = useRef(
    getDiscoverRequestKey(initialDiscoverUrl.query, emptyDiscoverFilters),
  );
  const [developers, setDevelopers] = useState([]);
  const [developersLoading, setDevelopersLoading] = useState(
    initialDiscoverUrl.tab === "developers",
  );
  const [developersError, setDevelopersError] = useState("");
  const [developersRetry, setDevelopersRetry] = useState(0);
  const [developersLoadedQuery, setDevelopersLoadedQuery] = useState(null);
  const [nextDeveloperCursor, setNextDeveloperCursor] = useState(null);
  const [hasMoreDevelopers, setHasMoreDevelopers] = useState(false);
  const [isLoadingMoreDevelopers, setIsLoadingMoreDevelopers] = useState(false);
  const [loadMoreDevelopersError, setLoadMoreDevelopersError] = useState("");
  const activeDiscoverFilterCount =
    Object.values(discoverFilters).filter(Boolean).length;
  const [sharedOpportunity, setSharedOpportunity] = useState(null);
  const [sharedOpportunityLoading, setSharedOpportunityLoading] = useState(
    Boolean(initialRoute.sharedOpportunityId),
  );
  const [sharedOpportunityError, setSharedOpportunityError] = useState("");
  const [myOpportunities, setMyOpportunities] = useState([]);
  const [myOpportunitiesLoading, setMyOpportunitiesLoading] = useState(
    initialRoute.page === "profile" || initialRoute.page === "public-profile",
  );
  const [myOpportunitiesError, setMyOpportunitiesError] = useState("");
  const [savedOpportunities, setSavedOpportunities] = useState([]);
  const [savedOpportunitiesUserId, setSavedOpportunitiesUserId] = useState("");
  const [savedOpportunitiesError, setSavedOpportunitiesError] = useState("");
  const [profileTab, setProfileTab] = useState("opportunities");
  const [profileChatRequest, setProfileChatRequest] = useState({ username: "", status: "NONE", direction: "" });
  const [isSendingChatRequest, setIsSendingChatRequest] = useState(false);
  const [shareCopiedOpportunityId, setShareCopiedOpportunityId] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: "",
    username: "",
    ...emptyProfileFields,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunityForm);
  const [opportunitySkillDraft, setOpportunitySkillDraft] = useState("");
  const [editingOpportunityId, setEditingOpportunityId] = useState(null);
  const [opportunityReturnPage, setOpportunityReturnPage] =
    useState("discover");
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState(() => {
    const authError = new URLSearchParams(window.location.search).get(
      "authError",
    );
    if (authError === "cancelled") return "Google sign-in was cancelled.";
    return authError ? "Google sign-in could not be completed. Try again." : "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [user, setUser] = useState(null);
  const [chatAlertToast, setChatAlertToast] = useState(null);
  const [requestedChatConversationId, setRequestedChatConversationId] = useState(initialRoute.chatConversationId ?? "");
  const seenChatAlerts = useRef(new Set());
  const updateChatConversationUrl = useCallback((conversationId, historyMethod = "pushState") => {
    const url = new URL(window.location.href);
    url.pathname = "/chat";
    url.search = "";
    url.hash = "";
    if (conversationId) url.searchParams.set("conversation", conversationId);
    const nextUrl = `${url.pathname}${url.search}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history[historyMethod](window.history.state, "", nextUrl);
    }
    setRequestedChatConversationId(conversationId);
  }, []);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isOpportunityComposerOpen, setIsOpportunityComposerOpen] =
    useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeCommentsOpportunity, setActiveCommentsOpportunity] =
    useState(null);
  const [pendingDeleteOpportunity, setPendingDeleteOpportunity] =
    useState(null);
  const [isDeletingOpportunity, setIsDeletingOpportunity] = useState(false);
  const [deleteOpportunityError, setDeleteOpportunityError] = useState("");
  const [pendingCompleteOpportunity, setPendingCompleteOpportunity] =
    useState(null);
  const [isCompletingOpportunity, setIsCompletingOpportunity] = useState(false);
  const [completeOpportunityError, setCompleteOpportunityError] = useState("");

  useEffect(() => {
    if (!user?.id || isCheckingSession) return undefined;
    let active = true;
    let isPolling = false;
    const pollChatAlerts = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const response = await fetch("/api/chat/notifications/chat-alert");
        if (!response.ok) return;
        const { notification } = await response.json();
        if (!active || !notification || seenChatAlerts.current.has(notification.id)) return;
        seenChatAlerts.current.add(notification.id);
        setChatAlertToast(notification);
        await fetch(`/api/chat/notifications/${encodeURIComponent(notification.id)}/read`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch {
        // Keep polling; a temporary alert failure should not interrupt the app.
      } finally {
        isPolling = false;
      }
    };
    pollChatAlerts();
    const intervalId = window.setInterval(pollChatAlerts, 10000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user?.id, isCheckingSession]);

  useEffect(() => {
    if (!chatAlertToast) return undefined;
    const timeoutId = window.setTimeout(() => setChatAlertToast(null), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [chatAlertToast]);

  useEffect(() => {
    writeDiscoverUrlState(initialDiscoverUrl.tab);
  }, [initialDiscoverUrl.tab]);

  useEffect(() => {
    if (
      !isEditProfileOpen &&
      !isOpportunityComposerOpen &&
      !isSettingsOpen &&
      !activeCommentsOpportunity &&
      !pendingDeleteOpportunity &&
      !pendingCompleteOpportunity
    )
      return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [
    isEditProfileOpen,
    isOpportunityComposerOpen,
    isSettingsOpen,
    activeCommentsOpportunity,
    pendingDeleteOpportunity,
    pendingCompleteOpportunity,
  ]);

  useEffect(() => {
    if (!isEditProfileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isSubmitting) setIsEditProfileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isEditProfileOpen, isSubmitting]);

  useEffect(() => {
    if (!isOpportunityComposerOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isSubmitting)
        setIsOpportunityComposerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpportunityComposerOpen, isSubmitting]);

  useEffect(() => {
    if (!isSettingsOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isSubmitting) setIsSettingsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isSettingsOpen, isSubmitting]);

  useEffect(() => {
    if (!pendingDeleteOpportunity) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isDeletingOpportunity)
        setPendingDeleteOpportunity(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pendingDeleteOpportunity, isDeletingOpportunity]);

  useEffect(() => {
    if (!pendingCompleteOpportunity) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isCompletingOpportunity)
        setPendingCompleteOpportunity(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pendingCompleteOpportunity, isCompletingOpportunity]);

  useEffect(() => {
    let isCurrent = true;
    const url = new URL(window.location.href);
    if (url.searchParams.has("authError")) {
      url.searchParams.delete("authError");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    async function checkSession() {
      try {
        let response;
        try {
          response = await fetch("/api/auth/me");
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 350));
          response = await fetch("/api/auth/me");
        }
        if (response.ok) {
          const result = await response.json();
          if (isCurrent) setUser(result.user);
        }
      } catch {
        if (isCurrent)
          setMessage(
            "Could not reach the server. Check your connection and try again.",
          );
      } finally {
        if (isCurrent) setIsCheckingSession(false);
      }
    }
    void checkSession();

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const isPublicProfile = page === "public-profile";
    if (
      !isPublicProfile &&
      (!user?.username || user.profileDetailsPromptPending)
    )
      return;

    let isCurrent = true;
    const viewingOwnProfile = user?.username === publicUsername;
    const endpoint =
      isPublicProfile && !viewingOwnProfile
        ? `/api/profiles/u/${encodeURIComponent(publicUsername)}`
        : "/api/profiles/me";

    fetch(endpoint)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error?.message ?? "Could not load profile.");
        if (!isCurrent) return;

        setProfileLoadFailed(false);
        setProfileData(result.profile);
        setProfileForm({
          name: result.profile.name,
          username: result.profile.username,
          city: result.profile.city ?? "",
          experience: result.profile.experience ?? "",
          skills: result.profile.skills.join(", "),
          description: result.profile.description ?? "",
        });
      })
      .catch((error) => {
        if (isCurrent) {
          setProfileLoadFailed(true);
          setMessage(error.message);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [
    page,
    publicUsername,
    user?.id,
    user?.username,
    user?.profileDetailsPromptPending,
  ]);

  useEffect(() => {
    const syncAppStateFromUrl = () => {
      const route = readAppRoute();
      const nextState = readDiscoverUrlState();
      setPage(route.page);
      setRequestedChatConversationId(route.chatConversationId ?? "");
      setPublicUsername(route.publicUsername);
      setSharedOpportunityId(route.sharedOpportunityId);
      setSharedOpportunity(null);
      setSharedOpportunityLoading(Boolean(route.sharedOpportunityId));
      setSharedOpportunityError("");
      setProfileData(null);
      setProfileLoadFailed(false);
      latestDiscoverQuery.current = getDiscoverRequestKey(
        nextState.query,
        emptyDiscoverFilters,
      );
      setDiscoverTab(nextState.tab);
      setDiscoverFilters(emptyDiscoverFilters);
      setDebouncedDiscoverFilters(emptyDiscoverFilters);
      setDiscoverQuery(nextState.query);
      setDebouncedDiscoverQuery(nextState.query);
      if (route.page === "discover" && !route.sharedOpportunityId) {
        if (nextState.tab === "opportunities") setOpportunitiesLoading(true);
        else {
          setDevelopersLoadedQuery(null);
          setDevelopersLoading(true);
          setNextDeveloperCursor(null);
          setHasMoreDevelopers(false);
          setIsLoadingMoreDevelopers(false);
          setLoadMoreDevelopersError("");
        }
      }
      if (route.page === "profile" || route.page === "public-profile") {
        setMyOpportunities([]);
        setMyOpportunitiesLoading(true);
        setMyOpportunitiesError("");
      }
    };

    window.addEventListener("popstate", syncAppStateFromUrl);
    return () => window.removeEventListener("popstate", syncAppStateFromUrl);
  }, []);

  useEffect(() => {
    if (page !== "discover" || sharedOpportunityId) return undefined;

    const timeoutId = window.setTimeout(() => {
      const query = discoverQuery.trim().slice(0, 100);
      setDebouncedDiscoverQuery(query);
      setDebouncedDiscoverFilters(discoverFilters);
      latestDiscoverQuery.current = getDiscoverRequestKey(
        query,
        discoverFilters,
      );
      writeDiscoverUrlState(discoverTab);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [discoverQuery, discoverTab, discoverFilters, page, sharedOpportunityId]);

  useEffect(() => {
    if (page !== "discover" || discoverTab !== "opportunities")
      return undefined;

    let isCurrent = true;

    const requestKey = getDiscoverRequestKey(
      debouncedDiscoverQuery,
      debouncedDiscoverFilters,
    );
    const params = getDiscoverRequestParams(
      debouncedDiscoverQuery,
      debouncedDiscoverFilters,
    );
    fetch(`/api/opportunities${params.size ? `?${params.toString()}` : ""}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error?.message ?? "Could not load opportunities.",
          );
        if (isCurrent) {
          setOpportunities(result.opportunities);
          setOpportunitiesError("");
          setOpportunitiesLoadedQuery(requestKey);
          setNextOpportunityCursor(result.nextCursor ?? null);
          setHasMoreOpportunities(Boolean(result.hasMore));
        }
      })
      .catch((error) => {
        if (isCurrent) setOpportunitiesError(error.message);
      })
      .finally(() => {
        if (isCurrent) setOpportunitiesLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [
    page,
    discoverTab,
    opportunitiesRetry,
    debouncedDiscoverQuery,
    debouncedDiscoverFilters,
  ]);

  useEffect(() => {
    if (
      page !== "discover" ||
      discoverTab !== "developers" ||
      developersLoadedQuery ===
        getDiscoverRequestKey(debouncedDiscoverQuery, debouncedDiscoverFilters)
    )
      return undefined;

    let isCurrent = true;

    const requestKey = getDiscoverRequestKey(
      debouncedDiscoverQuery,
      debouncedDiscoverFilters,
    );
    const params = getDiscoverRequestParams(
      debouncedDiscoverQuery,
      debouncedDiscoverFilters,
    );
    fetch(`/api/profiles${params.size ? `?${params.toString()}` : ""}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error?.message ?? "Could not load developer profiles.",
          );
        if (isCurrent) {
          setDevelopers(result.profiles);
          setDevelopersError("");
          setDevelopersLoadedQuery(requestKey);
          setNextDeveloperCursor(result.nextCursor ?? null);
          setHasMoreDevelopers(Boolean(result.hasMore));
          setLoadMoreDevelopersError("");
        }
      })
      .catch((error) => {
        if (isCurrent) setDevelopersError(error.message);
      })
      .finally(() => {
        if (isCurrent) setDevelopersLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [
    page,
    discoverTab,
    developersRetry,
    developersLoadedQuery,
    debouncedDiscoverQuery,
    debouncedDiscoverFilters,
  ]);

  useEffect(() => {
    if (!sharedOpportunityId) return undefined;
    let isCurrent = true;
    fetch(`/api/opportunities/${encodeURIComponent(sharedOpportunityId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error?.message ?? "This opportunity could not be found.",
          );
        if (isCurrent) {
          setSharedOpportunity(result.opportunity);
          setSharedOpportunityError("");
        }
      })
      .catch((error) => {
        if (isCurrent) setSharedOpportunityError(error.message);
      })
      .finally(() => {
        if (isCurrent) setSharedOpportunityLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [sharedOpportunityId]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let isCurrent = true;
    fetch("/api/opportunities/saved")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error?.message ?? "Could not load saved opportunities.",
          );
        if (isCurrent) {
          setSavedOpportunities(result.opportunities);
          setSavedOpportunitiesUserId(user.id);
          setSavedOpportunitiesError("");
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setSavedOpportunitiesUserId(user.id);
          setSavedOpportunitiesError(error.message);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (page !== "profile" && page !== "public-profile") return undefined;
    if (page === "public-profile" && isCheckingSession) return undefined;

    const viewingOwnProfile =
      page === "profile" || user?.username === publicUsername;
    if (viewingOwnProfile && !user?.id) return undefined;

    let isCurrent = true;
    const endpoint = viewingOwnProfile
      ? "/api/opportunities/mine"
      : `/api/opportunities/user/${encodeURIComponent(publicUsername)}`;

    fetch(endpoint)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error?.message ?? "Could not load opportunities.",
          );
        if (isCurrent) {
          setMyOpportunities(result.opportunities);
          setMyOpportunitiesError("");
        }
      })
      .catch((error) => {
        if (isCurrent) setMyOpportunitiesError(error.message);
      })
      .finally(() => {
        if (isCurrent) setMyOpportunitiesLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [page, publicUsername, user?.id, user?.username, isCheckingSession]);

  useEffect(() => {
    if (page !== "public-profile" || !user?.id || !profileData?.username || user.username === profileData.username) return undefined;
    const username = profileData.username;
    let isCurrent = true;
    fetch(`/api/chat/requests/with/${encodeURIComponent(username)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "Could not check the chat request.");
        if (isCurrent) setProfileChatRequest({ username, status: result.status ?? "NONE", direction: result.direction ?? "" });
      })
      .catch(() => {
        if (isCurrent) setProfileChatRequest({ username, status: "NONE", direction: "" });
      });
    return () => { isCurrent = false; };
  }, [page, user?.id, user?.username, profileData?.username]);

  function handleRegistrationChange(event) {
    const { name, value } = event.target;
    setRegistration((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  }

  function handleCredentialsChange(event) {
    const { name, value } = event.target;
    setCredentials((current) => ({ ...current, [name]: value }));
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setMessage("");

    const isRegistration = mode === "register";
    const endpoint = isRegistration ? "register" : "login";
    const body = isRegistration ? registration : credentials;
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };

    try {
      let response;
      try {
        response = await fetch(`/api/auth/${endpoint}`, requestOptions);
      } catch (error) {
        if (isRegistration) throw error;

        await new Promise((resolve) => window.setTimeout(resolve, 350));
        try {
          const existingSession = await fetch("/api/auth/me");
          if (existingSession.ok) response = existingSession;
        } catch {
          // The retry below will surface a connection error if the server is still unavailable.
        }
        if (!response) response = await fetch(`/api/auth/${endpoint}`, requestOptions);
      }
      const result = await response.json();

      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {});
        setMessage(result.error?.message ?? "Could not complete the request.");
        return;
      }

      if (isRegistration) {
        setMode("login");
        setCredentials({ identifier: registration.email, password: "" });
        setRegistration({ name: "", username: "", email: "", password: "" });
      } else {
        setUser(result.user);
        setCredentials((current) => ({ ...current, password: "" }));
        handleAppNavigation("discover");
      }
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error?.message ?? "Could not sign out. Try again.");
        return;
      }

      setUser(null);
      setSavedOpportunities([]);
      setSavedOpportunitiesUserId("");
      setSavedOpportunitiesError("");
      setMode("login");
      handleAppNavigation("discover");
      setMessage("");
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleProfileSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setMessage("");

    try {
      const response = await fetch("/api/auth/google/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: googleUsername }),
      });
      const result = await response.json();

      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {});
        setMessage(result.error?.message ?? "Could not complete your profile.");
        return;
      }

      setUser(result.user);
      setGoogleUsername("");
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setFieldErrors({});
    setMessage("");
  }

  function handleGoogleProfileChange(event) {
    const { value } = event.target;
    setGoogleUsername(value);
    setFieldErrors((current) => ({ ...current, username: undefined }));
    setMessage("");
  }

  async function handleProfileDetailsSubmit(event, skip = false) {
    event?.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setMessage("");

    try {
      const response = await fetch("/api/auth/profile-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skip ? {} : profileDetails),
      });
      const result = await response.json();

      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {});
        setMessage(result.error?.message ?? "Could not save your profile.");
        return;
      }

      setUser(result.user);
      setProfileDetails(emptyProfileFields);
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleProfileDetailsChange(event) {
    const { name, value } = event.target;
    setProfileDetails((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  }

  function handleProfileFormChange(event) {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  }

  function handlePasswordFormChange(event) {
    const { name, value } = event.target;
    setPasswordForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setMessage("");

    try {
      const response = await fetch("/api/profiles/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {});
        setMessage(result.error?.message ?? "Could not save your profile.");
        return;
      }

      setProfileData(result.profile);
      setUser((current) =>
        current
          ? {
              ...current,
              name: result.profile.name,
              username: result.profile.username,
            }
          : current,
      );
      setIsEditProfileOpen(false);
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    setFieldErrors({});
    setMessage("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/profiles/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {});
        setMessage(result.error?.message ?? "Could not change your password.");
        return;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsSettingsOpen(false);
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpportunityFormChange(event) {
    const { name, value, checked } = event.target;
    if (name === "categories") {
      setOpportunityForm((current) => ({
        ...current,
        categories: checked
          ? [...current.categories, value]
          : current.categories.filter((category) => category !== value),
      }));
    } else {
      setOpportunityForm((current) => ({
        ...current,
        [name]: value,
      }));
    }

    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  }

  function addOpportunitySkill() {
    const skill = opportunitySkillDraft.trim().replace(/,$/, "").trim();
    if (!skill) {
      setFieldErrors((current) => ({
        ...current,
        skillsSought: "Enter a skill before adding it.",
      }));
      return;
    }

    setOpportunityForm((current) => ({
      ...current,
      skillsSought: current.skillsSought.some(
        (existing) => existing.toLowerCase() === skill.toLowerCase(),
      )
        ? current.skillsSought
        : [...current.skillsSought, skill],
    }));
    setOpportunitySkillDraft("");
    setFieldErrors((current) => ({ ...current, skillsSought: undefined }));
    setMessage("");
  }

  async function handleOpportunitySubmit(event) {
    event.preventDefault();
    setFieldErrors({});
    setMessage("");

    const description = opportunityForm.description.trim();
    if (!description) {
      setFieldErrors({
        description: "Write a description for the opportunity.",
      });
      return;
    }

    const skillsSought = [
      ...opportunityForm.skillsSought,
      opportunitySkillDraft.trim(),
    ]
      .map((skill) => skill.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      const response = await fetch(
        editingOpportunityId
          ? `/api/opportunities/${encodeURIComponent(editingOpportunityId)}`
          : "/api/opportunities",
        {
          method: editingOpportunityId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            categories: opportunityForm.categories,
            skillsSought,
            experienceSought: opportunityForm.experienceSought || null,
            city: opportunityForm.city.trim() || null,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setFieldErrors(result.error?.fields ?? {});
        setMessage(
          result.error?.message ?? "Could not publish the opportunity.",
        );
        return;
      }

      if (editingOpportunityId) {
        setOpportunities((current) =>
          current.map((item) =>
            item.id === result.opportunity.id ? result.opportunity : item,
          ),
        );
        setMyOpportunities((current) =>
          current.map((item) =>
            item.id === result.opportunity.id ? result.opportunity : item,
          ),
        );
      } else {
        setOpportunities((current) => [result.opportunity, ...current]);
        setMyOpportunities((current) => [result.opportunity, ...current]);
      }

      setOpportunityForm(emptyOpportunityForm);
      setOpportunitySkillDraft("");
      setEditingOpportunityId(null);
      setIsOpportunityComposerOpen(false);
    } catch {
      setMessage(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenOpportunityComposer() {
    setFieldErrors({});
    setMessage("");
    setEditingOpportunityId(null);
    setOpportunityForm(emptyOpportunityForm);
    setOpportunitySkillDraft("");
    const returnPage = ["discover", "public-profile"].includes(page)
      ? "discover"
      : page === "create-opportunity"
        ? opportunityReturnPage
        : "profile";
    setOpportunityReturnPage(returnPage);
    setIsOpportunityComposerOpen(true);
  }

  function handleEditOpportunity(opportunity) {
    setFieldErrors({});
    setMessage("");
    setEditingOpportunityId(opportunity.id);
    setOpportunityForm({
      description: opportunity.description,
      categories: opportunity.categories,
      skillsSought: opportunity.skillsSought,
      experienceSought: opportunity.experienceSought ?? "",
      city: opportunity.city ?? "",
    });
    setOpportunitySkillDraft("");
    setOpportunityReturnPage(page === "discover" ? "discover" : "profile");
    setIsOpportunityComposerOpen(true);
  }

  async function handleDeleteOpportunity(opportunity) {
    setDeleteOpportunityError("");
    setPendingDeleteOpportunity(opportunity);
  }

  function updateOpportunityInLists(opportunityId, changes) {
    const update = (opportunity) =>
      opportunity.id === opportunityId
        ? { ...opportunity, ...changes }
        : opportunity;
    setOpportunities((current) => current.map(update));
    setMyOpportunities((current) => current.map(update));
    setSavedOpportunities((current) => current.map(update));
    setSharedOpportunity((current) =>
      current?.id === opportunityId ? { ...current, ...changes } : current,
    );
    setActiveCommentsOpportunity((current) =>
      current?.id === opportunityId ? { ...current, ...changes } : current,
    );
  }

  async function handleOpportunityStatusChange(
    opportunity,
    status,
    confirmed = false,
  ) {
    if (status === "COMPLETED" && !confirmed) {
      setCompleteOpportunityError("");
      setPendingCompleteOpportunity(opportunity);
      return false;
    }
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not update the opportunity status.",
        );
      updateOpportunityInLists(opportunity.id, result.opportunity);
      setOpportunitiesRetry((retry) => retry + 1);
      setMessage("");
      return true;
    } catch (error) {
      if (status === "COMPLETED") setCompleteOpportunityError(error.message);
      setMessage(
        error.message ||
          "Could not reach the server. Check your connection and try again.",
      );
      return false;
    }
  }

  async function confirmCompleteOpportunity() {
    if (!pendingCompleteOpportunity) return;
    setIsCompletingOpportunity(true);
    const completed = await handleOpportunityStatusChange(
      pendingCompleteOpportunity,
      "COMPLETED",
      true,
    );
    if (completed) setPendingCompleteOpportunity(null);
    setIsCompletingOpportunity(false);
  }

  function handleCommentCountChange(opportunityId, commentCount) {
    updateOpportunityInLists(opportunityId, { commentCount });
  }

  async function handleToggleOpportunityComments(opportunity) {
    const commentsEnabled = !opportunity.commentsEnabled;
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.id)}/comments`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentsEnabled }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not update the comment setting.",
        );
      updateOpportunityInLists(opportunity.id, {
        commentsEnabled: result.commentsEnabled,
      });
    } catch (error) {
      setMessage(
        error.message ||
          "Could not reach the server. Check your connection and try again.",
      );
    }
  }

  async function handleSaveOpportunity(opportunity) {
    if (!user) {
      setMode("login");
      setMessage("Sign in to save opportunities.");
      setPage("auth");
      return;
    }

    const isSaved = savedOpportunities.some(
      (item) => item.id === opportunity.id,
    );
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.id)}/save`,
        {
          method: isSaved ? "DELETE" : "POST",
        },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error?.message ?? "Could not update saved opportunities.",
        );
      }
      setSavedOpportunities((current) =>
        isSaved
          ? current.filter((item) => item.id !== opportunity.id)
          : [{ ...opportunity, savedAt: new Date().toISOString() }, ...current],
      );
      setSavedOpportunitiesUserId(user.id);
      setSavedOpportunitiesError("");
    } catch (error) {
      setMessage(
        error.message ||
          "Could not reach the server. Check your connection and try again.",
      );
    }
  }

  async function handleLoadMoreOpportunities() {
    if (!nextOpportunityCursor || isLoadingMoreOpportunities) return;
    const requestedQuery = getDiscoverRequestKey(
      debouncedDiscoverQuery,
      debouncedDiscoverFilters,
    );
    setIsLoadingMoreOpportunities(true);
    setLoadMoreOpportunitiesError("");
    try {
      const params = getDiscoverRequestParams(
        debouncedDiscoverQuery,
        debouncedDiscoverFilters,
        nextOpportunityCursor,
      );
      const response = await fetch(`/api/opportunities?${params.toString()}`);
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not load more opportunities.",
        );
      if (latestDiscoverQuery.current !== requestedQuery) return;

      setOpportunities((current) => {
        const existingIds = new Set(
          current.map((opportunity) => opportunity.id),
        );
        return [
          ...current,
          ...result.opportunities.filter(
            (opportunity) => !existingIds.has(opportunity.id),
          ),
        ];
      });
      setNextOpportunityCursor(result.nextCursor ?? null);
      setHasMoreOpportunities(Boolean(result.hasMore));
    } catch (error) {
      if (latestDiscoverQuery.current === requestedQuery) {
        setLoadMoreOpportunitiesError(
          error.message ||
            "Could not reach the server. Check your connection and try again.",
        );
      }
    } finally {
      if (latestDiscoverQuery.current === requestedQuery)
        setIsLoadingMoreOpportunities(false);
    }
  }

  async function handleLoadMoreDevelopers() {
    if (!nextDeveloperCursor || isLoadingMoreDevelopers) return;
    const requestedQuery = getDiscoverRequestKey(
      debouncedDiscoverQuery,
      debouncedDiscoverFilters,
    );
    setIsLoadingMoreDevelopers(true);
    setLoadMoreDevelopersError("");
    try {
      const params = getDiscoverRequestParams(
        debouncedDiscoverQuery,
        debouncedDiscoverFilters,
        nextDeveloperCursor,
      );
      const response = await fetch(`/api/profiles?${params.toString()}`);
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not load more developers.",
        );
      if (latestDiscoverQuery.current !== requestedQuery) return;

      setDevelopers((current) => {
        const existingIds = new Set(current.map((developer) => developer.id));
        return [
          ...current,
          ...result.profiles.filter(
            (developer) => !existingIds.has(developer.id),
          ),
        ];
      });
      setNextDeveloperCursor(result.nextCursor ?? null);
      setHasMoreDevelopers(Boolean(result.hasMore));
    } catch (error) {
      if (latestDiscoverQuery.current === requestedQuery) {
        setLoadMoreDevelopersError(
          error.message || "Could not load more developers.",
        );
      }
    } finally {
      if (latestDiscoverQuery.current === requestedQuery)
        setIsLoadingMoreDevelopers(false);
    }
  }

  function handleDiscoverFilterChange(name, value) {
    const nextFilters = { ...discoverFilters, [name]: value };
    const query = discoverQuery.trim().slice(0, 100);
    const requestKey = getDiscoverRequestKey(query, nextFilters);
    latestDiscoverQuery.current = requestKey;
    setDiscoverFilters(nextFilters);
    if (discoverTab === "opportunities") {
      setOpportunitiesLoading(requestKey !== opportunitiesLoadedQuery);
      setOpportunitiesError("");
      setNextOpportunityCursor(null);
      setHasMoreOpportunities(false);
      setIsLoadingMoreOpportunities(false);
      setLoadMoreOpportunitiesError("");
    } else {
      setDevelopersLoading(requestKey !== developersLoadedQuery);
      setDevelopersError("");
      setNextDeveloperCursor(null);
      setHasMoreDevelopers(false);
      setIsLoadingMoreDevelopers(false);
      setLoadMoreDevelopersError("");
    }
  }

  function handleClearDiscoverFilters() {
    const requestKey = getDiscoverRequestKey(
      discoverQuery.trim().slice(0, 100),
      emptyDiscoverFilters,
    );
    latestDiscoverQuery.current = requestKey;
    setDiscoverFilters(emptyDiscoverFilters);
    if (discoverTab === "opportunities") {
      setOpportunitiesLoading(requestKey !== opportunitiesLoadedQuery);
      setOpportunitiesError("");
      setNextOpportunityCursor(null);
      setHasMoreOpportunities(false);
      setIsLoadingMoreOpportunities(false);
      setLoadMoreOpportunitiesError("");
    } else {
      setDevelopersLoading(requestKey !== developersLoadedQuery);
      setDevelopersError("");
      setNextDeveloperCursor(null);
      setHasMoreDevelopers(false);
      setIsLoadingMoreDevelopers(false);
      setLoadMoreDevelopersError("");
    }
  }

  async function handleShareOpportunity(opportunity) {
    const url = new URL(
      `/opportunities/${encodeURIComponent(opportunity.id)}`,
      window.location.origin,
    ).toString();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `EthioDev opportunity by ${opportunity.owner.name}`,
          url,
        });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareCopiedOpportunityId(opportunity.id);
      window.setTimeout(
        () =>
          setShareCopiedOpportunityId((current) =>
            current === opportunity.id ? "" : current,
          ),
        1600,
      );
    } catch {
      setMessage(
        "Could not copy the opportunity link. Check your browser permissions and try again.",
      );
    }
  }

  async function confirmDeleteOpportunity() {
    if (!pendingDeleteOpportunity) return;
    setIsDeletingOpportunity(true);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(pendingDeleteOpportunity.id)}`,
        { method: "DELETE" },
      );
      const result = response.status === 204 ? {} : await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Could not delete the opportunity.",
        );

      setOpportunities((current) =>
        current.filter((item) => item.id !== pendingDeleteOpportunity.id),
      );
      setMyOpportunities((current) =>
        current.filter((item) => item.id !== pendingDeleteOpportunity.id),
      );
      setPendingDeleteOpportunity(null);
    } catch (error) {
      setDeleteOpportunityError(
        error.message ||
          "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsDeletingOpportunity(false);
    }
  }

  function handleAppNavigation(destination, chatConversationId = "") {
    if (destination === "chat") {
      if (!user) {
        setMode("login");
        setMessage("Sign in to view chat requests.");
        setPage("auth");
        return;
      }
      setPublicUsername("");
      setSharedOpportunityId("");
      setRequestedChatConversationId(chatConversationId);
      setPage("chat");
      const chatPath = chatConversationId
        ? `/chat?conversation=${encodeURIComponent(chatConversationId)}`
        : "/chat";
      if (`${window.location.pathname}${window.location.search}` !== chatPath) {
        window.history.pushState(window.history.state, "", chatPath);
      }
      return;
    }

    if (destination === "profile") {
      const alreadyOnOwnProfile =
        page === "profile" &&
        !publicUsername &&
        window.location.pathname === "/profile";
      if (alreadyOnOwnProfile) return;

      setProfileData(null);
      setProfileLoadFailed(false);
      setMyOpportunities([]);
      setMyOpportunitiesLoading(true);
      setMyOpportunitiesError("");
      setPublicUsername("");
      setSharedOpportunityId("");
      setSharedOpportunity(null);
      setPage("profile");
      if (window.location.pathname !== "/profile") {
        window.history.pushState(window.history.state, "", "/profile");
      }
      return;
    }

    if (destination === "discover") {
      const alreadyAtDiscover =
        page === "discover" &&
        !publicUsername &&
        !sharedOpportunityId &&
        window.location.pathname === "/";
      setPublicUsername("");
      setSharedOpportunityId("");
      setSharedOpportunity(null);
      setSharedOpportunityLoading(false);
      setSharedOpportunityError("");
      if (discoverTab === "opportunities") {
        setOpportunitiesLoading(
          opportunitiesLoadedQuery !==
            getDiscoverRequestKey(debouncedDiscoverQuery, discoverFilters),
        );
      } else {
        setDevelopersLoading(
          developersLoadedQuery !==
            getDiscoverRequestKey(debouncedDiscoverQuery, discoverFilters),
        );
      }
      latestDiscoverQuery.current = getDiscoverRequestKey(
        debouncedDiscoverQuery,
        discoverFilters,
      );
      setPage("discover");
      writeDiscoverUrlState(
        discoverTab,
        alreadyAtDiscover ? "replaceState" : "pushState",
        "/",
      );
    }
  }

  async function handleSendChatRequest() {
    if (!user || !profileData?.id || isSendingChatRequest) return;
    setIsSendingChatRequest(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: profileData.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not send the chat request.");
      setProfileChatRequest({ username: profileData.username, status: "PENDING", direction: "OUTGOING" });
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Could not reach the server. Try again.");
      if (error.message?.includes("already pending")) {
        setProfileChatRequest({ username: profileData.username, status: "PENDING", direction: "OUTGOING" });
      }
    } finally {
      setIsSendingChatRequest(false);
    }
  }

  const savedOpportunitiesLoading = Boolean(
    user?.id && savedOpportunitiesUserId !== user.id,
  );

  if (isCheckingSession) {
    return (
      <main className="auth-page [min-height:100vh] [display:grid] [place-items:center] [padding:32px_20px] [background:radial-gradient(ellipse_at_50%_0%,_rgb(23_92_73_/_16%),_transparent_45%),_#0d1114]">
        <p className="session-loading [color:#c0cece]">Checking sign-in...</p>
      </main>
    );
  }

  if (user && !user.username) {
    return (
      <main className="auth-page [min-height:100vh] [display:grid] [place-items:center] [padding:32px_20px] [background:radial-gradient(ellipse_at_50%_0%,_rgb(23_92_73_/_16%),_transparent_45%),_#0d1114]">
        <section
          className="auth-card [width:min(100%,_440px)] [padding:38px] [border:1px_solid_#252d31] [border-radius:20px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_24%)] [padding:28px_22px]"
          aria-labelledby="signed-in-heading"
        >
          {user.username && user.profileDetailsPromptPending ? (
            <>
              <h1
                className="max-[520px]:[font-size:26px]"
                id="signed-in-heading"
              >
                Complete your profile
              </h1>
              <p className="profile-prompt [margin:-16px_0_24px] [color:#aebabb] [line-height:1.5]">
                Add a few details to help developers find you.
              </p>
              <form onSubmit={handleProfileDetailsSubmit} noValidate>
                <OptionalProfileFields
                  values={profileDetails}
                  onChange={handleProfileDetailsChange}
                  errors={fieldErrors}
                  prefix="profile-details"
                />
                <Button variant="primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save profile"}
                </Button>
                <button
                  className="skip-button hover:enabled:text-[#edf3f4] [display:block] [margin:16px_auto_0] [padding:8px_12px] [border:0] [background:transparent] [color:#aebabb] [cursor:pointer] focus-visible:[outline:2px_solid_#9af1d0] focus-visible:[outline-offset:2px] disabled:[cursor:wait] disabled:[opacity:0.7]"
                  type="button"
                  onClick={() => handleProfileDetailsSubmit(undefined, true)}
                  disabled={isSubmitting}
                >
                  Skip for now
                </button>
              </form>
            </>
          ) : user.username ? (
            <>
              <h1
                className="max-[520px]:[font-size:26px]"
                id="signed-in-heading"
              >
                You’re signed in
              </h1>
              <p className="signed-in-user [margin:0_0_24px] [color:#d9e1e2]">
                {user.name}{" "}
                <span className="[margin-left:6px] [color:#91a2a5]">
                  @{user.username}
                </span>
              </p>
              <Button
                variant="primary"
                type="button"
                onClick={handleSignOut}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing out..." : "Sign out"}
              </Button>
            </>
          ) : (
            <>
              <h1
                className="max-[520px]:[font-size:26px]"
                id="signed-in-heading"
              >
                Choose a username
              </h1>
              <form onSubmit={handleGoogleProfileSubmit} noValidate>
                <div className="form-field [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] [display:grid] [gap:8px] [margin-bottom:18px]">
                  <label
                    className="[color:#d9e1e2] [font-size:14px] [font-weight:600]"
                    htmlFor="google-username"
                  >
                    Username
                  </label>
                  <input
                    className="focus:[border-color:#19c990] focus:[box-shadow:0_0_0_3px_rgb(25_201_144_/_15%)] [width:100%] [min-height:48px] [padding:0_14px] [border:1px_solid_#303a3e] [border-radius:12px] [outline:none] [background:#0d1215] [color:#f4f7f7] [transition:border-color_120ms_ease,_box-shadow_120ms_ease]"
                    id="google-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9_]{3,30}"
                    value={googleUsername}
                    onChange={(event) => {
                      handleGoogleProfileChange(event);
                    }}
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby={
                      fieldErrors.username ? "google-username-error" : undefined
                    }
                    required
                  />
                  {fieldErrors.username && (
                    <span
                      className="field-error [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
                      id="google-username-error"
                    >
                      {fieldErrors.username}
                    </span>
                  )}
                </div>
                <Button variant="primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Continue"}
                </Button>
              </form>
            </>
          )}
          {message && (
            <p
              className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
              role="status"
            >
              {message}
            </p>
          )}
        </section>
      </main>
    );
  }

  if (user?.profileDetailsPromptPending && !publicUsername) {
    return (
      <main className="auth-page [min-height:100vh] [display:grid] [place-items:center] [padding:32px_20px] [background:radial-gradient(ellipse_at_50%_0%,_rgb(23_92_73_/_16%),_transparent_45%),_#0d1114]">
        <section
          className="auth-card [width:min(100%,_440px)] [padding:38px] [border:1px_solid_#252d31] [border-radius:20px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_24%)] [padding:28px_22px]"
          aria-labelledby="signed-in-heading"
        >
          <h1 className="max-[520px]:[font-size:26px]" id="signed-in-heading">
            Complete your profile
          </h1>
          <p className="profile-prompt [margin:-16px_0_24px] [color:#aebabb] [line-height:1.5]">
            Add a few details to help developers find you.
          </p>
          <form onSubmit={handleProfileDetailsSubmit} noValidate>
            <OptionalProfileFields
              values={profileDetails}
              onChange={handleProfileDetailsChange}
              errors={fieldErrors}
              prefix="profile-details"
            />
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save profile"}
            </Button>
            <button
              className="skip-button hover:enabled:text-[#edf3f4] [display:block] [margin:16px_auto_0] [padding:8px_12px] [border:0] [background:transparent] [color:#aebabb] [cursor:pointer] focus-visible:[outline:2px_solid_#9af1d0] focus-visible:[outline-offset:2px] disabled:[cursor:wait] disabled:[opacity:0.7]"
              type="button"
              onClick={() => handleProfileDetailsSubmit(undefined, true)}
              disabled={isSubmitting}
            >
              Skip for now
            </button>
          </form>
          {message && (
            <p
              className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45]"
              role="status"
            >
              {message}
            </p>
          )}
        </section>
      </main>
    );
  }

  if (user || publicUsername || page === "discover") {
    const isOwnProfile = Boolean(
      user && (!publicUsername || user.username === profileData?.username),
    );
    const visibleOpportunities = opportunities.filter(
      (item) => item.id !== sharedOpportunityId,
    );
    const visibleDevelopers = developers.filter(
      (developer) => developer.id !== user?.id,
    );
    const needsProfile =
      page === "public-profile" ||
      Boolean(user?.username && !user.profileDetailsPromptPending);
    const isLoadingProfile = needsProfile && !profileData && !profileLoadFailed;
    const pageProps = {
      activeDiscoverFilterCount,
      addOpportunitySkill,
      areDiscoverFiltersOpen,
      confirmDeleteOpportunity,
      confirmCompleteOpportunity,
      completeOpportunityError,
      debouncedDiscoverQuery,
      deleteOpportunityError,
      developersError,
      developersLoadedQuery,
      developersLoading,
      discoverFilters,
      discoverQuery,
      discoverTab,
      editingOpportunityId,
      fieldErrors,
      handleAppNavigation,
      handleClearDiscoverFilters,
      handleDeleteOpportunity,
      handleOpportunityStatusChange,
      handleDiscoverFilterChange,
      handleEditOpportunity,
      handleLoadMoreDevelopers,
      handleLoadMoreOpportunities,
      handleOpenOpportunityComposer,
      handleOpportunityFormChange,
      handleOpportunitySubmit,
      handlePasswordChange,
      handlePasswordFormChange,
      handleProfileFormChange,
      handleProfileSave,
      handleSaveOpportunity,
      handleShareOpportunity,
      handleSignOut,
      handleToggleOpportunityComments,
      hasMoreDevelopers,
      hasMoreOpportunities,
      isDeletingOpportunity,
      isCompletingOpportunity,
      isEditProfileOpen,
      isLoadingMoreDevelopers,
      isLoadingMoreOpportunities,
      isLoadingProfile,
      isOwnProfile,
      isSettingsOpen,
      isSubmitting,
      getDiscoverRequestKey,
      latestDiscoverQuery,
      loadMoreDevelopersError,
      loadMoreOpportunitiesError,
      message,
      myOpportunities,
      myOpportunitiesError,
      myOpportunitiesLoading,
      opportunitiesError,
      opportunitiesLoadedQuery,
      opportunitiesLoading,
      opportunityForm,
      opportunityReturnPage,
      opportunitySkillDraft,
      page,
      passwordForm,
      pendingDeleteOpportunity,
      pendingCompleteOpportunity,
      profileData,
      profileChatRequest,
      isSendingChatRequest,
      handleSendChatRequest,
      profileForm,
      profileTab,
      savedOpportunities,
      savedOpportunitiesError,
      savedOpportunitiesLoading,
      setActiveCommentsOpportunity,
      setAreDiscoverFiltersOpen,
      setDevelopersError,
      setDevelopersLoading,
      setDevelopersRetry,
      setDiscoverQuery,
      setDiscoverTab,
      setEditingOpportunityId,
      setFieldErrors,
      setHasMoreDevelopers,
      setHasMoreOpportunities,
      setIsEditProfileOpen,
      setIsLoadingMoreDevelopers,
      setIsLoadingMoreOpportunities,
      setIsSettingsOpen,
      setLoadMoreDevelopersError,
      setLoadMoreOpportunitiesError,
      setMessage,
      setMyOpportunitiesLoading,
      setNextDeveloperCursor,
      setNextOpportunityCursor,
      setOpportunitiesError,
      setOpportunitiesLoading,
      setOpportunitiesRetry,
      setOpportunityForm,
      setOpportunitySkillDraft,
      setPendingDeleteOpportunity,
      setPendingCompleteOpportunity,
      setProfileTab,
      shareCopiedOpportunityId,
      sharedOpportunity,
      sharedOpportunityError,
      sharedOpportunityId,
      sharedOpportunityLoading,
      user,
      visibleDevelopers,
      visibleOpportunities,
      writeDiscoverUrlState,
    };

    return (
      <main className="profile-page min-h-screen bg-page p-0">
        <div className="app-shell grid min-h-screen min-w-0 grid-cols-[250px_minmax(0,1fr)] max-[760px]:grid-cols-[minmax(0,1fr)] max-[760px]:grid-rows-[auto_minmax(0,1fr)]">
          <AppSidebar
            user={user}
            activePage={
              page === "chat"
                ? "chat"
                : page === "discover" ||
              page === "public-profile" ||
              (page === "create-opportunity" &&
                opportunityReturnPage === "discover")
                ? "discover"
                : "profile"
            }
            onNavigate={handleAppNavigation}
            onSignIn={() => {
              setMode("login");
              setPage("auth");
            }}
            onRegister={() => {
              setMode("register");
              setPage("auth");
            }}
            onSignOut={handleSignOut}
          />
          {chatAlertToast && (
            <div
              className="fixed bottom-6 right-6 z-[60] flex max-w-[min(92vw,_420px)] items-center gap-4 rounded-xl border border-[#354044] bg-[#141a1e] px-5 py-4 text-[#e9f1f4] shadow-xl"
              role="status"
              aria-live="polite"
            >
              <span>
                {chatAlertToast.type === "CHAT_REQUEST_ACCEPTED"
                  ? `Your chat request was accepted by ${chatAlertToast.request?.recipient?.name ?? "a developer"}.`
                  : `New message from ${chatAlertToast.message?.sender?.name ?? "a developer"}.`}
              </span>
              <button
                className="shrink-0 text-[#38e6b0] hover:text-white"
                onClick={() => {
                  setChatAlertToast(null);
                  handleAppNavigation("chat", chatAlertToast.conversationId ?? chatAlertToast.message?.conversationId ?? "");
                }}
              >
                Open Chat
              </button>
              <button
                className="shrink-0 text-[#aab8bf] hover:text-white"
                aria-label="Dismiss chat alert"
                onClick={() => setChatAlertToast(null)}
              >
                ×
              </button>
            </div>
          )}
          {page === "discover" ? (
            <DiscoverPage {...pageProps} />
          ) : page === "chat" ? (
            <ChatPage
              user={user}
              requestedConversationId={requestedChatConversationId}
              onConversationUrlChange={updateChatConversationUrl}
            />
          ) : (
            <ProfilePage {...pageProps} />
          )}
          {page === "discover" && pendingDeleteOpportunity && (
            <div
              className="profile-modal-backdrop [&::-webkit-scrollbar]:hidden confirmation-backdrop [position:fixed] [z-index:50] [inset:0] [display:grid] [place-items:center] [overflow:hidden] [padding:24px] [background:rgb(3_8_10_/_78%)] [scrollbar-width:none] [padding:0] [padding:16px]"
              onMouseDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !isDeletingOpportunity
                )
                  setPendingDeleteOpportunity(null);
              }}
            >
              <section
                className="profile-edit-modal [&::-webkit-scrollbar]:hidden max-[600px]:[&:not(.confirmation-modal)]:w-full max-[600px]:[&:not(.confirmation-modal)]:max-w-none max-[600px]:[&:not(.confirmation-modal)]:h-dvh max-[600px]:[&:not(.confirmation-modal)]:max-h-dvh max-[600px]:[&:not(.confirmation-modal)]:rounded-none max-[600px]:[&:not(.confirmation-modal)]:border-0 max-[600px]:[&:not(.confirmation-modal)]:p-0 confirmation-modal [width:min(100%,_760px)] [max-height:min(88vh,_820px)] [max-height:min(88dvh,_820px)] [display:flex] [flex-direction:column] [overflow:hidden] [padding:0] [border:1px_solid_#303a3e] [border-radius:18px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_45%)] [scrollbar-width:none] [width:min(100%,_380px)] [max-height:min(80dvh,_420px)] [height:auto] [max-height:80dvh]"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-opportunity-heading"
                aria-describedby="delete-opportunity-description"
              >
                <ModalHeader>
                  <h2
                    className="max-[600px]:[font-size:21px]"
                    id="delete-opportunity-heading"
                  >
                    Delete opportunity?
                  </h2>
                  <ModalCloseButton
                    type="button"
                    label="Close confirmation"
                    onClick={() => setPendingDeleteOpportunity(null)}
                    disabled={isDeletingOpportunity}
                  >
                    &times;
                  </ModalCloseButton>
                </ModalHeader>
                <div className="profile-modal-scroll [&::-webkit-scrollbar]:hidden confirmation-content [min-height:0] [flex:1_1_auto] [overflow-y:auto] [padding:20px_24px] [overscroll-behavior:contain] [scrollbar-width:none] [padding:16px]">
                  <p
                    className="[margin:0] [color:#c0cece] [line-height:1.6]"
                    id="delete-opportunity-description"
                  >
                    This will remove the opportunity from your profile and
                    Discover. This action can’t be undone.
                  </p>
                  {deleteOpportunityError && (
                    <p
                      className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]"
                      role="alert"
                    >
                      {deleteOpportunityError}
                    </p>
                  )}
                </div>
                <ModalFooter>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setPendingDeleteOpportunity(null)}
                    disabled={isDeletingOpportunity}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    className="[padding-inline:12px] [font-size:13px]"
                    type="button"
                    onClick={confirmDeleteOpportunity}
                    disabled={isDeletingOpportunity}
                  >
                    {isDeletingOpportunity
                      ? "Deleting..."
                      : "Delete opportunity"}
                  </Button>
                </ModalFooter>
              </section>
            </div>
          )}
          {pendingCompleteOpportunity && (
            <div
              className="profile-modal-backdrop confirmation-backdrop [position:fixed] [z-index:50] [inset:0] [display:grid] [place-items:center] [overflow:hidden] [padding:16px] [background:rgb(3_8_10_/_78%)]"
              onMouseDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !isCompletingOpportunity
                )
                  setPendingCompleteOpportunity(null);
              }}
            >
              <section
                className="profile-edit-modal confirmation-modal [display:flex] [width:min(100%,_420px)] [height:auto] [max-height:80dvh] [flex-direction:column] [overflow:hidden] [padding:0] [border:1px_solid_#303a3e] [border-radius:18px] [background:#141a1e] [box-shadow:0_24px_80px_rgb(0_0_0_/_45%)]"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="complete-opportunity-heading"
                aria-describedby="complete-opportunity-description"
              >
                <ModalHeader>
                  <h2
                    className="max-[600px]:[font-size:21px]"
                    id="complete-opportunity-heading"
                  >
                    Mark this opportunity as completed?
                  </h2>
                  <ModalCloseButton
                    type="button"
                    label="Close confirmation"
                    onClick={() => setPendingCompleteOpportunity(null)}
                    disabled={isCompletingOpportunity}
                  >
                    &times;
                  </ModalCloseButton>
                </ModalHeader>
                <div className="profile-modal-scroll confirmation-content [min-height:0] [flex:1_1_auto] [overflow-y:auto] [padding:16px_20px]">
                  <p
                    className="[margin:0] [color:#c0cece] [line-height:1.6]"
                    id="complete-opportunity-description"
                  >
                    This ends recruiting and closes pending requests. You
                    cannot reopen the opportunity afterward. It will remain on
                    your profile and in Discover as completed work.
                  </p>
                  {completeOpportunityError && (
                    <p className="form-message [color:#ffaaaa] [font-size:13px] [line-height:1.45] [margin:18px_0_0]" role="alert">
                      {completeOpportunityError}
                    </p>
                  )}
                </div>
                <ModalFooter>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setPendingCompleteOpportunity(null)}
                    disabled={isCompletingOpportunity}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmCompleteOpportunity}
                    disabled={isCompletingOpportunity}
                  >
                    {isCompletingOpportunity
                      ? "Completing..."
                      : "Mark completed"}
                  </Button>
                </ModalFooter>
              </section>
            </div>
          )}
          {user && isOpportunityComposerOpen && (
            <OpportunityComposer
              editingOpportunityId={editingOpportunityId}
              opportunityForm={opportunityForm}
              setOpportunityForm={setOpportunityForm}
              opportunitySkillDraft={opportunitySkillDraft}
              setOpportunitySkillDraft={setOpportunitySkillDraft}
              fieldErrors={fieldErrors}
              message={message}
              setFieldErrors={setFieldErrors}
              handleOpportunityFormChange={handleOpportunityFormChange}
              addOpportunitySkill={addOpportunitySkill}
              handleOpportunitySubmit={handleOpportunitySubmit}
              isSubmitting={isSubmitting}
              onClose={() => {
                setIsOpportunityComposerOpen(false);
                setEditingOpportunityId(null);
                setOpportunityForm(emptyOpportunityForm);
                setOpportunitySkillDraft("");
                setFieldErrors({});
                setMessage("");
              }}
            />
          )}
          {activeCommentsOpportunity && (
            <CommentsDialog
              opportunity={activeCommentsOpportunity}
              user={user}
              isOwner={Boolean(
                user && user.id === activeCommentsOpportunity.owner.id,
              )}
              onClose={() => setActiveCommentsOpportunity(null)}
              onCommentCountChange={handleCommentCountChange}
            />
          )}
        </div>
      </main>
    );
  }

  return (
    <AuthPage
      mode={mode}
      handleAppNavigation={handleAppNavigation}
      setMessage={setMessage}
      handleSubmit={handleSubmit}
      registrationFields={registrationFields}
      registration={registration}
      handleRegistrationChange={handleRegistrationChange}
      fieldErrors={fieldErrors}
      credentials={credentials}
      handleCredentialsChange={handleCredentialsChange}
      isSubmitting={isSubmitting}
      message={message}
      switchMode={switchMode}
    />
  );
}

export default App;
