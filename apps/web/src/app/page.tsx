"use client";

import { useState } from "react";

const departments = [
  { name: "Academic Affairs", status: "Pending", icon: "A" },
  { name: "Library", status: "Pending", icon: "L" },
  { name: "Finance", status: "Pending", icon: "F" },
  { name: "Student Affairs", status: "Pending", icon: "S" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [showApplication, setShowApplication] = useState(false);

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

        <p className="nav-label">STUDENT MENU</p>
        {["Overview", "My Clearance", "Apply for Clearance", "Profile"].map(
          (item) => (
            <button
              key={item}
              className={`nav-item ${activeTab === item ? "active" : ""}`}
              onClick={() => {
                setActiveTab(item);
                if (item === "Apply for Clearance") setShowApplication(true);
                else setShowApplication(false);
              }}
            >
              <span className="nav-dot" />
              {item}
            </button>
          ),
        )}

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
            <h1>Student Clearance</h1>
          </div>
          <div className="user-profile">
            <div className="avatar">ST</div>
            <div>
              <strong>Student Account</strong>
              <span>Student Portal</span>
            </div>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <p className="muted">STUDENT DASHBOARD</p>
              <h2>
                Welcome back, <span>Student!</span>
              </h2>
              <p className="subheading">
                Manage your clearance application and track your progress.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setActiveTab("Apply for Clearance");
                setShowApplication(true);
              }}
            >
              + Apply for Clearance
            </button>
          </div>

          {showApplication ? (
            <section className="panel application-panel">
              <div className="section-heading">
                <div>
                  <h3>Clearance Application</h3>
                  <p>Start a new clearance request.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setShowApplication(false);
                    setActiveTab("Overview");
                  }}
                >
                  Back to overview
                </button>
              </div>
              <div className="notice">
                <strong>Before you begin</strong>
                <p>
                  Submitting an application may initiate reviews by the
                  university departments. Your application will be connected to
                  the backend in a later step.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() =>
                  alert("The application form will be connected to the API in the next step.")
                }
              >
                Start application
              </button>
            </section>
          ) : (
            <>
              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-top">
                    <span>Application status</span>
                    <span className="stat-icon blue">↗</span>
                  </div>
                  <h3>Not started</h3>
                  <p>No active application detected</p>
                </article>
                <article className="stat-card">
                  <div className="stat-top">
                    <span>Clearance progress</span>
                    <span className="stat-icon gold">%</span>
                  </div>
                  <h3>0%</h3>
                  <div className="progress-track">
                    <div className="progress-fill" />
                  </div>
                  <p>Complete all required departments</p>
                </article>
                <article className="stat-card">
                  <div className="stat-top">
                    <span>Departments</span>
                    <span className="stat-icon purple">▦</span>
                  </div>
                  <h3>0 of {departments.length}</h3>
                  <p>Departments cleared</p>
                </article>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h3>Department clearance</h3>
                    <p>Track the progress of each department.</p>
                  </div>
                  <span className="status-pill">Not started</span>
                </div>

                <div className="department-list">
                  {departments.map((department) => (
                    <div className="department-row" key={department.name}>
                      <div className="department-info">
                        <div className="department-icon">
                          {department.icon}
                        </div>
                        <div>
                          <strong>{department.name}</strong>
                          <span>Awaiting application</span>
                        </div>
                      </div>
                      <span className="pending-pill">{department.status}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bottom-grid">
                <article className="panel">
                  <h3>Next steps</h3>
                  <p className="panel-description">
                    Begin your clearance process when you are ready.
                  </p>
                  <ul className="steps-list">
                    <li><span>1</span> Submit a clearance application</li>
                    <li><span>2</span> Wait for department reviews</li>
                    <li><span>3</span> Resolve any outstanding issues</li>
                    <li><span>4</span> Receive final clearance</li>
                  </ul>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setActiveTab("Apply for Clearance");
                      setShowApplication(true);
                    }}
                  >
                    Get started →
                  </button>
                </article>

                <article className="panel info-panel">
                  <div className="info-symbol">i</div>
                  <h3>Clearance information</h3>
                  <p>
                    Keep track of your departmental requirements. If a
                    department requests additional information, check your
                    clearance details for instructions.
                  </p>
                  <div className="info-footer">EPSU Student Services</div>
                </article>
              </section>
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

